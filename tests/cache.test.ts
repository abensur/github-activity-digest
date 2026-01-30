import { describe, test, expect } from 'bun:test';
import { getCachedActivity, setCachedActivity, clearCache, getCacheStats } from '../lib/cache';

describe('Cache', () => {
  test('should cache and retrieve activity data', () => {
    clearCache();

    const repos = [{ full_name: 'owner/repo1' }, { full_name: 'owner/repo2' }];
    const since = new Date('2026-01-23');
    const data = {
      'owner/repo1': {
        mergedPRs: [],
        directCommits: [],
        totalStats: { additions: 100, deletions: 50, changedFiles: 5 }
      }
    };

    // Should return null when cache is empty
    expect(getCachedActivity(repos, since)).toBeNull();

    // Should cache data
    setCachedActivity(repos, since, data);

    // Should retrieve cached data
    const cached = getCachedActivity(repos, since);
    expect(cached).toEqual(data);
  });

  test('should clear cache', () => {
    const repos = [{ full_name: 'owner/repo' }];
    const since = new Date('2026-01-23');
    const data = {
      'owner/repo': {
        mergedPRs: [],
        directCommits: [],
        totalStats: { additions: 0, deletions: 0, changedFiles: 0 }
      }
    };

    setCachedActivity(repos, since, data);
    expect(getCachedActivity(repos, since)).toEqual(data);

    clearCache();
    expect(getCachedActivity(repos, since)).toBeNull();
  });

  test('should return cache stats', () => {
    clearCache();

    const repos = [{ full_name: 'owner/repo' }];
    const since = new Date('2026-01-23');
    const data = {
      'owner/repo': {
        mergedPRs: [],
        directCommits: [],
        totalStats: { additions: 0, deletions: 0, changedFiles: 0 }
      }
    };

    setCachedActivity(repos, since, data);

    const stats = getCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.entries.length).toBe(1);
    expect(stats.entries[0].repos).toBe(1);
  });
});
