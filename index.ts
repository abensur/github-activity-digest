#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty';
import { Octokit } from '@octokit/rest';
import { loadConfig, type Config } from './lib/config';
import { initializeAIClient, generateSummary, type AIClient } from './lib/ai';
import { getAllRepositories } from './lib/github';
import { trackRepositoryActivities } from './lib/activity';
import { getCachedActivity, setCachedActivity } from './lib/cache';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { logger } from './lib/logger';

const main = defineCommand({
  meta: {
    name: 'github-activity-digest',
    description: 'Generate AI-powered summaries of GitHub repository activity',
    version: '2.0.0'
  },
  args: {
    org: {
      type: 'string',
      description: 'GitHub organization name'
    },
    user: {
      type: 'string',
      description: 'GitHub username'
    },
    topics: {
      type: 'string',
      description: 'Comma-separated list of topics'
    },
    file: {
      type: 'string',
      description: 'Path to file with repository list'
    },
    repos: {
      type: 'string',
      description: 'Comma-separated list of owner/repo'
    },
    days: {
      type: 'string',
      description: 'Number of days to look back',
      default: '7'
    },
    'no-cache': {
      type: 'boolean',
      description: 'Bypass cache and fetch fresh data',
      default: false
    }
  },
  async run({ args }) {
    logger.box('GitHub Weekly Activity Report Generator');

    const config: Config = await loadConfig({
      org: args.org,
      user: args.user,
      topics: args.topics,
      file: args.file,
      repos: args.repos,
      days: args.days ? parseInt(args.days, 10) : undefined,
      noCache: args['no-cache']
    });

    const octokit = new Octokit({
      auth: config.github.token,
      log: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
      }
    });
    const aiClient: AIClient = initializeAIClient(config);

    logger.start('Fetching repositories...');
    const repos = await getAllRepositories(octokit, config);

    if (repos.length === 0) {
      logger.error('No repositories found matching the criteria');
      process.exit(1);
    }

    logger.success(`Found ${repos.length} repositories matching the criteria`);

    const since = new Date(config.period.startDate);
    let repoActivities = config.noCache ? null : getCachedActivity(repos, since);

    if (repoActivities) {
      logger.info('Using cached activity data');
    } else {
      if (config.noCache) {
        logger.info('Cache bypassed (--no-cache flag)');
      }
      repoActivities = await trackRepositoryActivities(octokit, repos, since);
      if (!config.noCache) {
        await setCachedActivity(repos, since, repoActivities);
      }
    }

    const activeRepos = Object.entries(repoActivities).filter(
      ([_, activity]) => activity.mergedPRs.length > 0 || activity.directCommits.length > 0
    );

    if (activeRepos.length === 0) {
      logger.warn('No activity found in the specified period');
      process.exit(0);
    }

    logger.success(`Activity found in ${activeRepos.length} repositories`);

    logger.start('Generating AI summary...');
    const summary = await generateSummary(
      aiClient,
      config,
      repoActivities,
      config.period.startDate,
      config.period.endDate
    );

    logger.success('Summary generated successfully!');
    logger.log('\n' + summary + '\n');

    if (config.output.archiveDir) {
      const archiveDir = config.output.archiveDir;
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `weekly-report-${timestamp}.md`;
      const filepath = join(archiveDir, filename);

      await mkdir(archiveDir, { recursive: true });
      await Bun.write(filepath, summary);

      logger.success(`Saved to: ${filepath}`);
    }
  }
});

runMain(main);
