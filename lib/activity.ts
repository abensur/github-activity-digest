import type { Octokit } from '@octokit/rest';
import type { RepoActivity } from './ai';
import { logger } from './logger';
import { withRetry, withRateLimit } from './retry';

const GITHUB_PAGE_SIZE = 100;
const MAX_DIRECT_COMMITS = 50;
const BATCH_SIZE = 10;
const PR_BODY_MAX_LENGTH = 500;

interface PR {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author?: { date?: string };
  };
}

interface GitHubCommitDetail extends GitHubCommit {
  stats?: { additions: number; deletions: number };
  files?: Array<any>;
}

async function getMergedPRs(octokit: Octokit, owner: string, repo: string, since: Date): Promise<PR[]> {
  return withRetry(async () => {
    try {
      const prs = await octokit.paginate(octokit.pulls.list, {
        owner,
        repo,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: GITHUB_PAGE_SIZE
      });

      return (prs as PR[]).filter(pr => pr.merged_at && new Date(pr.merged_at) >= since);
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) return [];
      throw error;
    }
  });
}

async function getPRCommits(octokit: Octokit, owner: string, repo: string, prNumber: number) {
  return withRetry(async () => {
    try {
      const commits = await octokit.paginate(octokit.pulls.listCommits, {
        owner,
        repo,
        pull_number: prNumber,
        per_page: GITHUB_PAGE_SIZE
      });

      return (commits as GitHubCommit[]).map(c => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message,
        date: c.commit.author?.date
      }));
    } catch (error) {
      return [];
    }
  });
}

async function getPRStats(octokit: Octokit, owner: string, repo: string, prNumber: number) {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    return {
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files
    };
  } catch (error) {
    return { additions: 0, deletions: 0, changedFiles: 0 };
  }
}

async function getDirectCommits(octokit: Octokit, owner: string, repo: string, since: Date, mergedPRShas: Set<string>) {
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    const commits = await octokit.paginate(octokit.repos.listCommits, {
      owner,
      repo,
      sha: defaultBranch,
      since: since.toISOString(),
      per_page: GITHUB_PAGE_SIZE
    });

    // Filter out commits from PRs
    const directCommits = (commits as GitHubCommit[]).filter(c => {
      const message = c.commit.message;
      if (message.startsWith('Merge pull request')) return false;
      if (mergedPRShas.has(c.sha)) return false;
      return true;
    });

    // Get stats for each commit
    const commitsWithStats = await Promise.all(
      directCommits.slice(0, MAX_DIRECT_COMMITS).map(async (c) => {
        try {
          const { data: commitData } = await octokit.repos.getCommit({
            owner,
            repo,
            ref: c.sha
          });
          return {
            sha: c.sha.substring(0, 7),
            message: c.commit.message,
            date: c.commit.author?.date,
            stats: {
              additions: commitData.stats?.additions || 0,
              deletions: commitData.stats?.deletions || 0,
              changedFiles: commitData.files?.length || 0
            }
          };
        } catch {
          return {
            sha: c.sha.substring(0, 7),
            message: c.commit.message,
            date: c.commit.author?.date,
            stats: { additions: 0, deletions: 0, changedFiles: 0 }
          };
        }
      })
    );

    return { branch: defaultBranch, commits: commitsWithStats };
  } catch (error) {
    // Silently ignore expected errors (empty repos, etc)
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      if (status === 409 || status === 404) return null;
    }
    return null;
  }
}

async function getRepoActivity(octokit: Octokit, owner: string, repo: string, since: Date): Promise<RepoActivity> {
  const activity: RepoActivity = {
    mergedPRs: [],
    directCommits: [],
    totalStats: { additions: 0, deletions: 0, changedFiles: 0 }
  };

  try {
    const mergedPRs = await getMergedPRs(octokit, owner, repo, since);
    const prShas = new Set<string>();

    // Process all PRs in parallel
    const prDataPromises = mergedPRs.map(pr =>
      Promise.all([
        getPRCommits(octokit, owner, repo, pr.number),
        getPRStats(octokit, owner, repo, pr.number)
      ]).then(([commits, stats]) => ({ pr, commits, stats }))
    );

    const prResults = await Promise.all(prDataPromises);

    // Aggregate results
    for (const { pr, commits, stats } of prResults) {
      if (pr.merge_commit_sha) {
        prShas.add(pr.merge_commit_sha);
      }
      commits.forEach(c => prShas.add(c.sha));

      activity.mergedPRs.push({
        number: pr.number,
        title: pr.title,
        body: pr.body?.substring(0, PR_BODY_MAX_LENGTH) || '',
        mergedAt: pr.merged_at!,
        commits: commits,
        stats: stats
      });

      activity.totalStats.additions += stats.additions;
      activity.totalStats.deletions += stats.deletions;
      activity.totalStats.changedFiles += stats.changedFiles;
    }

    // Get direct commits
    const directData = await getDirectCommits(octokit, owner, repo, since, prShas);
    if (directData && directData.commits.length > 0) {
      activity.directCommits = directData.commits;

      for (const commit of directData.commits) {
        activity.totalStats.additions += commit.stats.additions;
        activity.totalStats.deletions += commit.stats.deletions;
        activity.totalStats.changedFiles += commit.stats.changedFiles;
      }
    }
  } catch (error) {
    // Silently handle errors - already logged in retry logic if needed
  }

  return activity;
}

export async function trackRepositoryActivities(
  octokit: Octokit,
  repos: Array<{ full_name: string }>,
  since: Date
): Promise<Record<string, RepoActivity>> {
  const repoActivities: Record<string, RepoActivity> = {};
  const totalRepos = repos.length;
  let processedRepos = 0;

  logger.start(`Fetching activity from ${totalRepos} repositories...`);

  for (let i = 0; i < repos.length; i += BATCH_SIZE) {
    const batch = repos.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (repo) => {
      const [owner, name] = repo.full_name.split('/');
      const activity = await getRepoActivity(octokit, owner, name, since);
      const prCount = activity.mergedPRs.length;
      const commitCount = activity.directCommits.length;

      return { name: repo.full_name, activity, prCount, commitCount };
    });

    const results = await Promise.allSettled(batchPromises);

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        repoActivities[result.value.name] = result.value.activity;
        processedRepos++;

        const { prCount, commitCount } = result.value;
        if (prCount > 0 || commitCount > 0) {
          logger.success(`${result.value.name}: ${prCount} PR(s), ${commitCount} commit(s)`);
        }
      } else {
        processedRepos++;
      }
    });

    // Progress bar visual
    const percentage = Math.round((processedRepos / totalRepos) * 100);
    const filled = Math.floor(percentage / 2);
    const empty = 50 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    logger.info(`${bar} ${percentage}% (${processedRepos}/${totalRepos})`);
  }

  logger.success(`Completed! Processed ${totalRepos} repositories`);
  return repoActivities;
}
