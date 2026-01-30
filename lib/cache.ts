import type { RepoActivity } from './ai';

interface CacheEntry {
  data: Record<string, RepoActivity>;
  timestamp: number;
}

const CACHE_TTL = 1000 * 60 * 30;
const cache = new Map<string, CacheEntry>();

function getCacheKey(repos: Array<{ full_name: string }>, since: Date): string {
  const repoNames = repos.map(r => r.full_name).sort().join(',');
  const sinceStr = since.toISOString();
  return `${repoNames}|${sinceStr}`;
}

export function getCachedActivity(
  repos: Array<{ full_name: string }>,
  since: Date
): Record<string, RepoActivity> | null {
  const key = getCacheKey(repos, since);
  const entry = cache.get(key);

  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCachedActivity(
  repos: Array<{ full_name: string }>,
  since: Date,
  data: Record<string, RepoActivity>
): void {
  const key = getCacheKey(repos, since);
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      repos: Object.keys(entry.data).length
    }))
  };
}
