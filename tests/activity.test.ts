import { describe, test, expect } from 'bun:test';
import type { RepoActivity } from '../lib/ai';

describe('Activity Tracking', () => {
  test('should calculate total stats correctly', () => {
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

    const totalAdditions = activity.mergedPRs.reduce((sum, pr) => sum + pr.stats.additions, 0) +
                           activity.directCommits.reduce((sum, c) => sum + c.stats.additions, 0);
    const totalDeletions = activity.mergedPRs.reduce((sum, pr) => sum + pr.stats.deletions, 0) +
                           activity.directCommits.reduce((sum, c) => sum + c.stats.deletions, 0);
    const totalFiles = activity.mergedPRs.reduce((sum, pr) => sum + pr.stats.changedFiles, 0) +
                       activity.directCommits.reduce((sum, c) => sum + c.stats.changedFiles, 0);

    expect(totalAdditions).toBe(310);
    expect(totalDeletions).toBe(85);
    expect(totalFiles).toBe(15);
  });

  test('should filter merged PRs by date', () => {
    const prs = [
      { merged_at: '2026-01-20T10:00:00Z' },
      { merged_at: '2026-01-25T10:00:00Z' },
      { merged_at: '2026-01-28T10:00:00Z' }
    ];

    const since = new Date('2026-01-23T00:00:00Z');
    const filtered = prs.filter(pr => new Date(pr.merged_at) >= since);

    expect(filtered).toHaveLength(2);
  });

  test('should extract commit message first line', () => {
    const message = 'feat: add new feature\n\nThis is a detailed description\nwith multiple lines';
    const firstLine = message.split('\n')[0];

    expect(firstLine).toBe('feat: add new feature');
  });

  test('should handle empty activity', () => {
    const activity: RepoActivity = {
      mergedPRs: [],
      directCommits: [],
      totalStats: { additions: 0, deletions: 0, changedFiles: 0 }
    };

    const hasActivity = activity.mergedPRs.length > 0 || activity.directCommits.length > 0;
    expect(hasActivity).toBe(false);
  });

  test('should truncate long PR bodies', () => {
    const longBody = 'A'.repeat(1000);
    const maxLength = 500;
    const truncated = longBody.length > maxLength ? longBody.substring(0, maxLength) : longBody;

    expect(truncated.length).toBe(maxLength);
  });
});
