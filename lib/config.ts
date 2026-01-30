import path from 'path';
import { z } from 'zod';

const DEFAULTS = {
  PERIOD_DAYS: 7,
  ARCHIVE_DIR: 'archive',
  LANGUAGE: 'English',
  AI_PROVIDER: 'anthropic' as const,
  AI_MODEL: 'claude-sonnet-4-20250514',
  AI_MAX_TOKENS: 4000,
  AI_TEMPERATURE: 1.0,
  PROMPT_TEMPLATE: 'prompt-template.txt'
} as const;

const ConfigSchema = z.object({
  mode: z.enum(['organization', 'user', 'topics', 'file', 'list']).default('organization'),
  source: z.object({
    organization: z.string().optional(),
    user: z.string().optional(),
    topics: z.array(z.string()).optional(),
    repositoriesFile: z.string().optional(),
    repositories: z.array(z.string()).optional()
  }).default({}),
  filters: z.object({
    excludeRepos: z.array(z.string()).optional(),
    includeRepos: z.array(z.string()).optional(),
    onlyPublic: z.boolean().optional(),
    onlyPrivate: z.boolean().optional()
  }).default({}),
  period: z.object({
    days: z.number().default(DEFAULTS.PERIOD_DAYS),
    startDate: z.string().default(''),
    endDate: z.string().default('')
  }).default({ days: DEFAULTS.PERIOD_DAYS, startDate: '', endDate: '' }),
  github: z.object({
    token: z.string()
  }),
  ai: z.object({
    provider: z.enum(['anthropic', 'openai']).default(DEFAULTS.AI_PROVIDER),
    model: z.string().default(DEFAULTS.AI_MODEL),
    apiKey: z.string().optional(),
    maxTokens: z.number().default(DEFAULTS.AI_MAX_TOKENS),
    temperature: z.number().default(DEFAULTS.AI_TEMPERATURE),
    promptTemplate: z.string().default(DEFAULTS.PROMPT_TEMPLATE)
  }).default({
    provider: DEFAULTS.AI_PROVIDER,
    model: DEFAULTS.AI_MODEL,
    maxTokens: DEFAULTS.AI_MAX_TOKENS,
    temperature: DEFAULTS.AI_TEMPERATURE,
    promptTemplate: DEFAULTS.PROMPT_TEMPLATE
  }),
  output: z.object({
    archiveDir: z.string().default(DEFAULTS.ARCHIVE_DIR),
    language: z.string().default(DEFAULTS.LANGUAGE),
    dateFormat: z.string().default('YYYY-MM-DD')
  }).default({
    archiveDir: DEFAULTS.ARCHIVE_DIR,
    language: DEFAULTS.LANGUAGE,
    dateFormat: 'YYYY-MM-DD'
  }),
  noCache: z.boolean().optional()
});

export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(cliArgs?: {
  org?: string;
  user?: string;
  topics?: string;
  file?: string;
  repos?: string;
  days?: number;
  noCache?: boolean;
}): Promise<Config> {
  const configPath = path.join(process.cwd(), 'config.json');
  let rawConfig: any = {};

  const configFile = Bun.file(configPath);
  if (await configFile.exists()) {
    rawConfig = await configFile.json();
  }

  if (process.env.MODE) rawConfig.mode = process.env.MODE;
  if (process.env.ORGANIZATION) {
    rawConfig.source = { ...rawConfig.source, organization: process.env.ORGANIZATION };
  }
  if (process.env.USER) {
    rawConfig.source = { ...rawConfig.source, user: process.env.USER };
  }
  if (process.env.TOPICS) {
    rawConfig.source = { ...rawConfig.source, topics: process.env.TOPICS.split(',') };
  }
  if (process.env.REPOSITORIES_FILE) {
    rawConfig.source = { ...rawConfig.source, repositoriesFile: process.env.REPOSITORIES_FILE };
  }
  if (process.env.PERIOD_DAYS) {
    rawConfig.period = { ...rawConfig.period, days: parseInt(process.env.PERIOD_DAYS, 10) };
  }

  if (cliArgs) {
    if (cliArgs.org) {
      rawConfig.mode = 'organization';
      rawConfig.source = { ...rawConfig.source, organization: cliArgs.org };
    }
    if (cliArgs.user) {
      rawConfig.mode = 'user';
      rawConfig.source = { ...rawConfig.source, user: cliArgs.user };
    }
    if (cliArgs.topics) {
      rawConfig.mode = 'topics';
      rawConfig.source = { ...rawConfig.source, topics: cliArgs.topics.split(',').map((t: string) => t.trim()) };
    }
    if (cliArgs.file) {
      rawConfig.mode = 'file';
      rawConfig.source = { ...rawConfig.source, repositoriesFile: cliArgs.file };
    }
    if (cliArgs.repos) {
      rawConfig.mode = 'list';
      rawConfig.source = { ...rawConfig.source, repositories: cliArgs.repos.split(',').map((r: string) => r.trim()) };
    }
    if (cliArgs.days) {
      rawConfig.period = { ...rawConfig.period, days: cliArgs.days };
    }
    if (cliArgs.noCache) {
      rawConfig.noCache = true;
    }
  }

  rawConfig.github = { token: process.env.GITHUB_TOKEN || rawConfig.github?.token || '' };

  if (!rawConfig.ai?.apiKey) {
    const provider = rawConfig.ai?.provider || DEFAULTS.AI_PROVIDER;
    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      if (!rawConfig.ai) rawConfig.ai = {};
      rawConfig.ai.apiKey = process.env.ANTHROPIC_API_KEY;
    } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      if (!rawConfig.ai) rawConfig.ai = {};
      rawConfig.ai.apiKey = process.env.OPENAI_API_KEY;
    } else if (process.env.AI_API_KEY) {
      if (!rawConfig.ai) rawConfig.ai = {};
      rawConfig.ai.apiKey = process.env.AI_API_KEY;
    }
  }

  const config = ConfigSchema.parse(rawConfig);

  if (!config.github.token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  switch (config.mode) {
    case 'organization':
      if (!config.source.organization) {
        throw new Error('Organization name is required when mode is "organization"');
      }
      break;
    case 'user':
      if (!config.source.user) {
        throw new Error('Username is required when mode is "user"');
      }
      break;
    case 'topics':
      if (!config.source.topics?.length) {
        throw new Error('At least one topic is required when mode is "topics"');
      }
      break;
    case 'file':
      if (!config.source.repositoriesFile) {
        throw new Error('Repository file path is required when mode is "file"');
      }
      break;
    case 'list':
      if (!config.source.repositories?.length) {
        throw new Error('At least one repository is required when mode is "list"');
      }
      break;
  }

  const endDate = new Date();
  const startDate = getLastWeekDate(config.period.days);
  config.period.startDate = formatDate(startDate);
  config.period.endDate = formatDate(endDate);

  return config;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getLastWeekDate(days: number): Date {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - days);
  lastWeek.setHours(0, 0, 0, 0);
  return lastWeek;
}
