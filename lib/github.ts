import type { Octokit } from '@octokit/rest';
import path from 'path';
import type { Config } from './config';
import { logger } from './logger';
import { withRateLimit } from './retry';

interface Repository {
  full_name: string;
  name: string;
  private: boolean;
}

const GITHUB_PAGE_SIZE = 100;

function handleError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`${context}: ${message}`);
}

async function getOrgRepositories(octokit: Octokit, orgName: string): Promise<Repository[]> {
  try {
    const repos = await withRateLimit(octokit, () => octokit.paginate(octokit.repos.listForOrg, {
      org: orgName,
      type: 'all',
      per_page: GITHUB_PAGE_SIZE
    }));
    return repos as Repository[];
  } catch (error) {
    handleError('Error fetching org repositories', error);
    return [];
  }
}

async function getUserRepositories(octokit: Octokit, username: string): Promise<Repository[]> {
  try {
    const repos = await withRateLimit(octokit, () => octokit.paginate(octokit.repos.listForUser, {
      username,
      type: 'all',
      per_page: GITHUB_PAGE_SIZE
    }));
    logger.info(`Fetched ${repos.length} repositories for user ${username}`);
    return repos as Repository[];
  } catch (error) {
    handleError('Error fetching user repositories', error);
    return [];
  }
}

async function getRepositoriesByTopics(octokit: Octokit, topics: string[]): Promise<Repository[]> {
  try {
    const allRepos: Repository[] = [];

    for (const topic of topics) {
      const result = await withRateLimit(octokit, () => octokit.paginate(octokit.search.repos, {
        q: `topic:${topic}`,
        per_page: GITHUB_PAGE_SIZE
      }));
      allRepos.push(...(result as Repository[]));
    }

    // Remove duplicates based on full_name
    const uniqueRepos = Array.from(
      new Map(allRepos.map(repo => [repo.full_name, repo])).values()
    );

    return uniqueRepos;
  } catch (error) {
    handleError('Error fetching repositories by topics', error);
    return [];
  }
}

async function fetchRepository(octokit: Octokit, fullName: string): Promise<Repository | null> {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) {
    logger.warn(`Skipping invalid repository name: ${fullName}`);
    return null;
  }

  try {
    const { data } = await withRateLimit(octokit, () => octokit.repos.get({ owner, repo }));
    return data as Repository;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not fetch repository ${fullName}: ${message}`);
    return null;
  }
}

async function getRepositoriesFromFile(octokit: Octokit, filePath: string): Promise<Repository[]> {
  try {
    const fullPath = path.resolve(filePath);
    const file = Bun.file(fullPath);
    const content = await file.text();
    const repoNames = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    const results = await Promise.all(
      repoNames.map(name => fetchRepository(octokit, name))
    );

    return results.filter((repo): repo is Repository => repo !== null);
  } catch (error) {
    handleError('Error reading repositories file', error);
    return [];
  }
}

async function getRepositoriesFromList(octokit: Octokit, repositories: string[]): Promise<Repository[]> {
  try {
    const results = await Promise.all(
      repositories.map(name => fetchRepository(octokit, name))
    );

    return results.filter((repo): repo is Repository => repo !== null);
  } catch (error) {
    handleError('Error fetching repositories from list', error);
    return [];
  }
}

function applyFilters(repos: Repository[], filters: Config['filters']): Repository[] {
  return repos.filter(repo => {
    // Include filter
    if (filters.includeRepos?.length) {
      const matches = filters.includeRepos.some(pattern =>
        repo.name.includes(pattern) || repo.full_name.includes(pattern)
      );
      if (!matches) return false;
    }

    // Exclude filter
    if (filters.excludeRepos?.length) {
      const matches = filters.excludeRepos.some(pattern =>
        repo.name.includes(pattern) || repo.full_name.includes(pattern)
      );
      if (matches) return false;
    }

    // Visibility filters
    if (filters.onlyPublic && repo.private) return false;
    if (filters.onlyPrivate && !repo.private) return false;

    return true;
  });
}

export async function getAllRepositories(octokit: Octokit, config: Config): Promise<Repository[]> {
  let repos: Repository[] = [];

  // Note: Config validation in loadConfig() guarantees required values exist per mode
  switch (config.mode) {
    case 'organization':
      repos = await getOrgRepositories(octokit, config.source.organization!);
      break;

    case 'user':
      repos = await getUserRepositories(octokit, config.source.user!);
      break;

    case 'topics':
      repos = await getRepositoriesByTopics(octokit, config.source.topics!);
      break;

    case 'file':
      repos = await getRepositoriesFromFile(octokit, config.source.repositoriesFile!);
      break;

    case 'list':
      repos = await getRepositoriesFromList(octokit, config.source.repositories!);
      break;
  }

  const filtered = applyFilters(repos, config.filters);

  // Apply maxRepos limit
  if (filtered.length > config.filters.maxRepos) {
    logger.warn(`Limiting to ${config.filters.maxRepos} repositories (found ${filtered.length}). Increase filters.maxRepos to process more.`);
    return filtered.slice(0, config.filters.maxRepos);
  }

  return filtered;
}

export async function getRateLimitInfo(octokit: Octokit): Promise<{ remaining: number; limit: number; resetAt: Date }> {
  try {
    const { data } = await octokit.rateLimit.get();
    return {
      remaining: data.rate.remaining,
      limit: data.rate.limit,
      resetAt: new Date(data.rate.reset * 1000)
    };
  } catch {
    return { remaining: -1, limit: -1, resetAt: new Date() };
  }
}

export function displayRateLimitInfo(info: { remaining: number; limit: number; resetAt: Date }): void {
  if (info.remaining < 0) return;
  
  const percent = Math.round((info.remaining / info.limit) * 100);
  const resetIn = Math.max(0, Math.ceil((info.resetAt.getTime() - Date.now()) / 60000));
  
  if (info.remaining < 100) {
    logger.warn(`⚠️ API rate limit: ${info.remaining}/${info.limit} (${percent}%) - resets in ${resetIn}min`);
  } else {
    logger.info(`📊 API rate limit: ${info.remaining}/${info.limit} (${percent}%) - resets in ${resetIn}min`);
  }
}
