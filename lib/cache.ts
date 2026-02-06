import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { RepoActivity } from './ai';

interface CacheEntry {
  data: Record<string, RepoActivity>;
  timestamp: number;
  repos: string[];
  since: string;
}

const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const CACHE_DIR = join(process.cwd(), '.cache');

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(repos: Array<{ full_name: string }>, since: Date): string {
  const repoNames = repos.map(r => r.full_name).sort().join(',');
  const sinceStr = since.toISOString().split('T')[0]; // Date only
  const hash = createHash('sha256').update(`${repoNames}|${sinceStr}`).digest('hex').substring(0, 16);
  return hash;
}

function getCachePath(key: string): string {
  return join(CACHE_DIR, `activity-${key}.json`);
}

export function getCachedActivity(
  repos: Array<{ full_name: string }>,
  since: Date
): Record<string, RepoActivity> | null {
  ensureCacheDir();

  const key = getCacheKey(repos, since);
  const cachePath = getCachePath(key);

  if (!existsSync(cachePath)) return null;

  try {
    const raw = readFileSync(cachePath, 'utf-8');
    const content = JSON.parse(raw) as CacheEntry;
    const age = Date.now() - content.timestamp;

    if (age > CACHE_TTL) {
      unlinkSync(cachePath);
      return null;
    }

    return content.data;
  } catch {
    // Corrupted cache file
    try { unlinkSync(cachePath); } catch {}
    return null;
  }
}

export async function setCachedActivity(
  repos: Array<{ full_name: string }>,
  since: Date,
  data: Record<string, RepoActivity>
): Promise<void> {
  ensureCacheDir();

  const key = getCacheKey(repos, since);
  const cachePath = getCachePath(key);

  const entry: CacheEntry = {
    data,
    timestamp: Date.now(),
    repos: repos.map(r => r.full_name),
    since: since.toISOString()
  };

  await Bun.write(cachePath, JSON.stringify(entry, null, 2));
}

export function clearCache(): void {
  if (!existsSync(CACHE_DIR)) return;

  const files = readdirSync(CACHE_DIR);
  for (const file of files) {
    if (file.startsWith('activity-') && file.endsWith('.json')) {
      unlinkSync(join(CACHE_DIR, file));
    }
  }
}

export function getCacheStats() {
  ensureCacheDir();

  const files = readdirSync(CACHE_DIR).filter(f => f.startsWith('activity-') && f.endsWith('.json'));

  return {
    size: files.length,
    entries: files.map(file => {
      const filePath = join(CACHE_DIR, file);
      const stat = statSync(filePath);
      return {
        file,
        age: Date.now() - stat.mtimeMs,
        sizeKb: Math.round(stat.size / 1024)
      };
    })
  };
}
