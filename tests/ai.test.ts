import { describe, test, expect } from 'bun:test';
import { initializeAIClient } from '../lib/ai';
import type { Config } from '../lib/config';

describe('AI Client', () => {
  test('should initialize Anthropic client', () => {
    const config: Partial<Config> = {
      ai: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'test-key',
        maxTokens: 4000,
        temperature: 1.0,
        promptTemplate: 'prompt.txt'
      }
    };

    const client = initializeAIClient(config as Config);
    expect(client).toBeDefined();
  });

  test('should initialize OpenAI client', () => {
    const config: Partial<Config> = {
      ai: {
        provider: 'openai',
        model: 'gpt-4-turbo',
        apiKey: 'test-key',
        maxTokens: 4000,
        temperature: 0.7,
        promptTemplate: 'prompt.txt'
      }
    };

    const client = initializeAIClient(config as Config);
    expect(client).toBeDefined();
  });

  test('should throw error when API key is missing', () => {
    const config: Partial<Config> = {
      ai: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4000,
        temperature: 1.0,
        promptTemplate: 'prompt.txt'
      }
    };

    expect(() => initializeAIClient(config as Config)).toThrow();
  });
});
