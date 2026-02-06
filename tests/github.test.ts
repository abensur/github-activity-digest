import { describe, test, expect } from 'bun:test';

describe('GitHub Integration', () => {
  test('should handle repository filtering by name', () => {
    const repos = [
      { full_name: 'org/api-service', name: 'api-service', private: false },
      { full_name: 'org/test-repo', name: 'test-repo', private: false },
      { full_name: 'org/frontend-app', name: 'frontend-app', private: true }
    ];

    const excludePattern = 'test-';
    const filtered = repos.filter(r => !r.name.startsWith(excludePattern));

    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.name)).toEqual(['api-service', 'frontend-app']);
  });

  test('should filter public/private repos', () => {
    const repos = [
      { full_name: 'org/public-repo', name: 'public-repo', private: false },
      { full_name: 'org/private-repo', name: 'private-repo', private: true }
    ];

    const publicOnly = repos.filter(r => !r.private);
    const privateOnly = repos.filter(r => r.private);

    expect(publicOnly).toHaveLength(1);
    expect(publicOnly[0]?.name).toBe('public-repo');
    expect(privateOnly).toHaveLength(1);
    expect(privateOnly[0]?.name).toBe('private-repo');
  });

  test('should parse repository full_name correctly', () => {
    const fullName = 'facebook/react';
    const [owner, repo] = fullName.split('/');

    expect(owner).toBe('facebook');
    expect(repo).toBe('react');
  });

  test('should handle invalid repository names', () => {
    const invalidNames = ['', 'noowner', 'owner/', '/repo', 'owner//repo'];

    invalidNames.forEach(name => {
      const parts = name.split('/');
      const isValid = parts.length === 2 && (parts[0]?.length ?? 0) > 0 && (parts[1]?.length ?? 0) > 0;
      expect(isValid).toBe(false);
    });
  });
});
