import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { loadConfig, formatDate, getLastWeekDate } from '../lib/config';

describe('Config', () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  test('should load user mode', async () => {
    const config = await loadConfig({ user: 'torvalds', days: 30 });

    expect(config.mode).toBe('user');
    expect(config.source.user).toBe('torvalds');
    expect(config.period.days).toBe(30);
  });

  test('should load org mode', async () => {
    const config = await loadConfig({ org: 'facebook' });

    expect(config.mode).toBe('organization');
    expect(config.source.organization).toBe('facebook');
  });

  test('should parse topics', async () => {
    const config = await loadConfig({ topics: 'react,vue,typescript' });

    expect(config.mode).toBe('topics');
    expect(config.source.topics).toEqual(['react', 'vue', 'typescript']);
  });

  test('should apply Zod defaults', async () => {
    const config = await loadConfig({ user: 'test' });

    expect(config.ai.provider).toBe('anthropic');
    expect(config.ai.model).toBe('claude-sonnet-4-20250514');
    expect(config.output.language).toBe('English');
  });

  test('should handle --no-cache flag', async () => {
    const config = await loadConfig({ user: 'test', noCache: true });
    expect(config.noCache).toBe(true);
  });

  test('should throw when GITHUB_TOKEN missing', async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(loadConfig({ user: 'test' })).rejects.toThrow('GITHUB_TOKEN');
  });

  test('formatDate formats correctly', () => {
    const date = new Date('2026-01-30T12:00:00Z');
    expect(formatDate(date)).toBe('2026-01-30');
  });

  test('getLastWeekDate calculates correctly', () => {
    const result = getLastWeekDate(7);
    const diff = Math.floor((Date.now() - result.getTime()) / (1000 * 60 * 60 * 24));
    expect(diff).toBeGreaterThanOrEqual(6);
    expect(diff).toBeLessThanOrEqual(7);
  });
});
