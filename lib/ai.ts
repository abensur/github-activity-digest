import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import path from 'path';
import type { Config } from './config';
import { logger } from './logger';

const DEFAULT_PROMPT_TEMPLATE = `You are a technical writer creating a weekly development summary for a software organization.
Analyze the following repository activity data and create a clear and informative summary.

**IMPORTANT - PLAIN TEXT FORMAT (NO MARKDOWN):**
The output will be shared across multiple platforms (Slack, WhatsApp, email).
- DO NOT use any formatting: no *, _, #, ##, **, bold, italics, etc.
- DO NOT use bullet points like • or -
- Use only plain text and emojis
- Separate sections with blank lines
- Use UPPERCASE for emphasis if needed

**Content Guidelines:**
- Organize the summary BY REPOSITORY
- For each repository, summarize what was delivered/changed in short sentences
- Use emojis to visually separate sections
- Be specific about features, fixes, and improvements
- Write everything in {language}

**Repository Activity Data ({period_start} to {period_end}):**
{activity_data}

**Output Format (PLAIN TEXT):**

📊 WEEKLY SUMMARY
{period_start} to {period_end}

[One or two sentences summarizing the week's highlights]

📦 repository-name
[X files changed, +Y/-Z lines]
Description of what was delivered in one or two sentences. Next delivery described here as well.

📦 another-repository
[X files changed, +Y/-Z lines]
Description of changes.

[Repeat for each repository]

Automatically generated from {active_repos} active repositories.

**END OF FORMAT**

Keep descriptions informative but concise. Highlight business value when possible.`;

export type AIClient = Anthropic | OpenAI;

export interface RepoActivity {
  mergedPRs: Array<{
    number: number;
    title: string;
    body: string;
    mergedAt: string;
    commits: Array<{ sha: string; message: string; date?: string }>;
    stats: { additions: number; deletions: number; changedFiles: number };
  }>;
  directCommits: Array<{
    sha: string;
    message: string;
    date?: string;
    stats: { additions: number; deletions: number; changedFiles: number };
  }>;
  totalStats: { additions: number; deletions: number; changedFiles: number };
}

export function initializeAIClient(config: Config): AIClient {
  if (!config.ai.apiKey) {
    throw new Error(`AI API key is required. Set ${config.ai.provider.toUpperCase()}_API_KEY environment variable or add it to config.json`);
  }

  switch (config.ai.provider) {
    case 'anthropic':
      return new Anthropic({ apiKey: config.ai.apiKey });
    case 'openai':
      return new OpenAI({ apiKey: config.ai.apiKey });
    default:
      throw new Error(`Unsupported AI provider '${config.ai.provider}'. Supported: anthropic, openai`);
  }
}

export async function generateSummary(
  aiClient: AIClient,
  config: Config,
  repoActivities: Record<string, RepoActivity>,
  periodStart: string,
  periodEnd: string
): Promise<string> {
  // Prepare data for AI
  const dataForAI = Object.entries(repoActivities)
    .filter(([_, activity]) =>
      activity.mergedPRs.length > 0 || activity.directCommits.length > 0
    )
    .map(([repoName, activity]) => ({
      repository: repoName,
      stats: activity.totalStats,
      mergedPRs: activity.mergedPRs.map(pr => ({
        title: pr.title,
        description: pr.body,
        stats: pr.stats,
        originalCommits: pr.commits.map(c => c.message.split('\n')[0])
      })),
      directCommits: activity.directCommits.map(c => ({
        message: c.message.split('\n')[0],
        stats: c.stats
      }))
    }));

  if (dataForAI.length === 0) {
    return `📊 Weekly Summary - ${periodStart} to ${periodEnd}\n\nNo repository activity during this period.`;
  }

  const templatePath = path.join(process.cwd(), config.ai.promptTemplate);
  let promptTemplate = DEFAULT_PROMPT_TEMPLATE;

  const templateFile = Bun.file(templatePath);
  if (await templateFile.exists()) {
    promptTemplate = await templateFile.text();
  } else {
    logger.warn(`Prompt template not found at ${templatePath}, using default`);
  }

  const prompt = promptTemplate
    .replace(/{language}/g, config.output.language || 'English')
    .replace(/{period_start}/g, periodStart)
    .replace(/{period_end}/g, periodEnd)
    .replace(/{activity_data}/g, JSON.stringify(dataForAI, null, 2))
    .replace(/{active_repos}/g, dataForAI.length.toString());

  logger.info(`Generating AI summary with ${config.ai.provider} (${config.ai.model})...`);

  try {
    if (config.ai.provider === 'anthropic' && aiClient instanceof Anthropic) {
      const message = await aiClient.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
        messages: [{ role: 'user', content: prompt }]
      });
      const firstBlock = message.content[0];
      if (firstBlock && firstBlock.type === 'text') {
        return firstBlock.text;
      }
      return '';

    } else if (config.ai.provider === 'openai' && aiClient instanceof OpenAI) {
      const response = await aiClient.chat.completions.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
        messages: [{ role: 'user', content: prompt }]
      });
      return response.choices[0]?.message.content ?? '';

    } else {
      throw new Error(`Unsupported AI provider: ${config.ai.provider}`);
    }
  } catch (error) {
    logger.error('Error generating AI summary:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
