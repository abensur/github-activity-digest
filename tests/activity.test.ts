import { describe, test, expect } from 'bun:test';
import type { RepoActivity } from '../lib/ai';
import {
  calculateTotalStats,
  filterPRsByDate,
  truncatePRBody,
  getCommitFirstLine
} from '../lib/activity';

describe('Activity Tracking', () => {
  test('should calculate total stats correctly using calculateTotalStats', () => {
    const activity: RepoActivity = {
      mergedPRs: [
        {
          number: 1,
          title: 'Feature A',
          body: 'Description',
          mergedAt: '2026-01-25',
          commits: [],
          stats: { additions: 100, deletions: 50, changedFiles: 5 }
        },
        {
          number: 2,
          title: 'Feature B',
          body: 'Description',
          mergedAt: '2026-01-26',
          commits: [],
          stats: { additions: 200, deletions: 30, changedFiles: 8 }
        }
      ],
      directCommits: [
        {
          sha: 'abc123',
          message: 'Fix bug',
          stats: { additions: 10, deletions: 5, changedFiles: 2 }
        }
      ],
      totalStats: { additions: 0, deletions: 0, changedFiles: 0 }
    };

    const stats = calculateTotalStats(activity);

    expect(stats.additions).toBe(310);
    expect(stats.deletions).toBe(85);
    expect(stats.changedFiles).toBe(15);
  });

  test('should filter merged PRs by date using filterPRsByDate', () => {
    const prs = [
      { merged_at: '2026-01-20T10:00:00Z' },
      { merged_at: '2026-01-25T10:00:00Z' },
      { merged_at: '2026-01-28T10:00:00Z' },
      { merged_at: null }
    ];

    const since = new Date('2026-01-23T00:00:00Z');
    const filtered = filterPRsByDate(prs, since);

    expect(filtered).toHaveLength(2);
  });

  test('should extract commit message first line using getCommitFirstLine', () => {
    const message = 'feat: add new feature\n\nThis is a detailed description\nwith multiple lines';
    const firstLine = getCommitFirstLine(message);

    expect(firstLine).toBe('feat: add new feature');
  });

  test('should handle empty activity', () => {
    const activity: RepoActivity = {
      mergedPRs: [],
      directCommits: [],
      totalStats: { additions: 0, deletions: 0, changedFiles: 0 }
    };

    const stats = calculateTotalStats(activity);
    expect(stats.additions).toBe(0);
    expect(stats.deletions).toBe(0);
    expect(stats.changedFiles).toBe(0);
  });

  test('should truncate long PR bodies using truncatePRBody', () => {
    const longBody = 'A'.repeat(1000);
    const truncated = truncatePRBody(longBody);

    expect(truncated.length).toBe(500);
  });

  test('should handle null PR body', () => {
    expect(truncatePRBody(null)).toBe('');
  });

  test('should not truncate short PR body', () => {
    const shortBody = 'Short description';
    expect(truncatePRBody(shortBody)).toBe(shortBody);
  });
});
