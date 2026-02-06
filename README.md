# GitHub Activity Digest

A GitHub Action that generates AI-powered weekly summaries of repository activity. Add to any workflow to get automated progress reports.

## Quick Start

Add to your workflow:

```yaml
- uses: abensur/github-activity-digest@v1
  with:
    mode: organization
    organization: my-org
    days: 7
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## ✨ Features

- **🎯 Flexible Sources** - Organizations, users, topics, or custom lists
- **🤖 Multi-AI** - Anthropic Claude or OpenAI GPT
- **📊 Comprehensive** - PRs, commits, and code statistics
- **⚡ Fast** - Parallel processing, caching, automatic retry
- **🌍 Multi-Language** - Output in any language

## Full Workflow Example

```yaml
name: Weekly Activity Digest

on:
  schedule:
    - cron: '0 10 * * 5'  # Every Friday at 10:00 AM UTC
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate-summary:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate Weekly Summary
        id: digest
        uses: abensur/github-activity-digest@v1
        with:
          mode: organization
          organization: ${{ github.repository_owner }}
          days: 7
          ai-provider: anthropic
          language: English
          max-repos: 100
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Commit Summary
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add archive/
          git diff --staged --quiet || git commit -m "Weekly summary"
          git push
```

### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `mode` | Source mode: organization, user, topics, list | `organization` |
| `organization` | GitHub org name (organization mode) | - |
| `user` | GitHub username (user mode) | - |
| `topics` | Comma-separated topics (topics mode) | - |
| `repositories` | Comma-separated owner/repo (list mode) | - |
| `days` | Days to look back | `7` |
| `ai-provider` | anthropic or openai | `anthropic` |
| `ai-model` | AI model name | `claude-sonnet-4-20250514` |
| `language` | Output language | `English` |
| `max-repos` | Max repositories to process | `500` |
| `exclude-repos` | Comma-separated exclude patterns | - |
| `include-repos` | Comma-separated include patterns | - |
| `only-public` | Only public repos | `false` |
| `only-private` | Only private repos | `false` |
| `archive-dir` | Directory to save summaries | `archive` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `summary` | The generated summary content |
| `summary-file` | Path to the saved summary file |
| `repos-processed` | Number of repositories processed |
| `active-repos` | Number of repositories with activity |

## � Authentication

### GitHub Token

The `GITHUB_TOKEN` is automatically provided by GitHub Actions. For organization access, create a [Personal Access Token](https://github.com/settings/tokens/new?scopes=repo,read:org) with `repo` and `read:org` scopes.

### AI Provider Keys

Add to repository secrets (Settings → Secrets → Actions):
- **Anthropic**: [Get API key →](https://console.anthropic.com/settings/keys)
- **OpenAI**: [Get API key →](https://platform.openai.com/api-keys)

## ⚙️ Configuration

### config.json

```json
{
  "mode": "organization",
  "source": { "organization": "your-org" },
  "filters": {
    "excludeRepos": ["archived-", "test-"],
    "includeRepos": ["api-", "app-"],
    "maxRepos": 500
  },
  "period": { "days": 7 },
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 4000,
    "temperature": 1.0
  },
  "output": {
    "archiveDir": "archive",
    "language": "English"
  }
}
```

### Available Modes

| Mode | Description | CLI Example |
|------|-------------|-------------|
| `organization` | All repos from a GitHub org | `--org facebook` |
| `user` | All repos from any user | `--user torvalds` |
| `topics` | Repos by GitHub topics | `--topics ai,ml` |
| `file` | Custom list from file | `--file repos.txt` |
| `list` | Direct array in config | `repositories: [...]` |

### AI Providers

**Anthropic Claude (default):**
```bash
ANTHROPIC_API_KEY=sk-ant-xxx
```

**OpenAI GPT:**
```bash
OPENAI_API_KEY=sk-xxx
```
```json
{ "ai": { "provider": "openai", "model": "gpt-4-turbo" } }
```

## � CLI Usage (Development)

The action can also be run locally as a CLI tool:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone https://github.com/abensur/github-activity-digest
cd github-activity-digest
bun install

# Run
bun start -- --user torvalds --days 7
bun start -- --org vercel --days 7
bun start -- --topics nextjs,react
```

### CLI Options

```bash
Options:
  --org <name>        Organization mode
  --user <name>       User mode
  --topics <list>     Topics mode (comma-separated)
  --file <path>       File mode (list of repos)
  --days <n>          Days to look back (default: 7)
  --no-cache          Force refresh, bypass cache
  --provider <name>   AI provider: anthropic or openai
  --model <name>      AI model name
```

## 📝 Output

Generated summaries are saved to `archive/weekly-report-YYYY-MM-DD.md` by default.

Example output:
```markdown
# Weekly Activity Summary
Period: January 23 - January 30, 2025

## Overview
Significant development activity across 5 repositories with
12 merged pull requests and 47 direct commits.

## Repository Details

### api-service
- **12 files changed** | +450 / -120 lines
- Implemented JWT authentication system
- Added rate limiting middleware
- Fixed memory leak in WebSocket handler

### frontend-dashboard
- **8 files changed** | +280 / -90 lines
- Redesigned mobile navigation
- Performance optimizations (50% faster load time)
- Added dark mode support
```

## 🔧 Advanced Features

### Smart Caching
Activity data is cached to `.cache/` directory for 30 minutes. The cache persists across runs, making it ideal for CI/CD workflows.

**For GitHub Actions**, add caching to your workflow:
```yaml
- uses: actions/cache@v4
  with:
    path: .cache
    key: github-activity-${{ github.run_id }}
    restore-keys: github-activity-
```

**Force refresh:** Use `--no-cache` to bypass cache and fetch the latest commits:
```bash
bun start -- --user torvalds --days 7 --no-cache
```

This is useful when you need to include commits that were just pushed.

### Automatic Retry
Network requests automatically retry with exponential backoff (1s → 2s → 4s) on transient failures. Rate limit errors are handled gracefully.

### Visual Progress
Real-time progress indicators show:
- Repository processing: `██████░░░░ 60% (12/20)`
- Activity collection status
- Cache hit rate

### Filters
Fine-tune which repositories to include:

```json
{
  "filters": {
    "excludeRepos": ["archived-", "test-"],
    "includeRepos": ["api-", "service-"],
    "onlyPublic": false,
    "onlyPrivate": false,
    "maxRepos": 500
  }
}
```



## 📂 Project Structure

```
github-activity-digest/
├── index.ts                     # Main entry point (Citty CLI)
├── action.yml                   # GitHub Action definition
├── Dockerfile                   # Docker image for GitHub Action
├── entrypoint.sh                # Action entrypoint script
├── lib/
│   ├── config.ts                # Config loading with Zod validation
│   ├── ai.ts                    # Multi-provider AI client
│   ├── github.ts                # Repository fetching
│   ├── activity.ts              # Activity tracking & stats
│   ├── retry.ts                 # Exponential backoff logic
│   ├── cache.ts                 # File-based caching (30min TTL)
│   └── logger.ts                # Centralized logging (consola)
├── tests/
│   ├── config.test.ts           # Config & utility tests
│   ├── cache.test.ts            # Cache system tests
│   ├── ai.test.ts               # AI client tests
│   ├── retry.test.ts            # Retry logic tests
│   ├── github.test.ts           # GitHub integration tests
│   └── activity.test.ts         # Activity tracking tests
├── config.json                  # Main configuration
├── prompt-template.txt          # AI prompt customization
├── .env                         # API keys & secrets
├── .cache/                      # Cached activity data
└── archive/                     # Generated summaries
```

## 🔧 Development

```bash
# Run the tool
bun start

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Type check
bun run typecheck

# Watch mode (auto-restart on changes)
bun --watch index.ts
```

### Local Action Testing

Test the GitHub Action locally using [act](https://github.com/nektos/act):

```bash
# Install act
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
# or with package manager:
# brew install act        # macOS
# yay -S act              # Arch Linux
# sudo dnf install act    # Fedora

# Create secrets file from .env
cp .env .secrets

# Run the workflow locally
act -j generate-summary --secret-file .secrets

# Run with specific event
act workflow_dispatch --secret-file .secrets
```

### Building the Docker Image

```bash
# Build locally
docker build -t github-activity-digest .

# Test locally
docker run --rm \
  -e GITHUB_TOKEN="$GITHUB_TOKEN" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e INPUT_MODE=user \
  -e INPUT_USER=torvalds \
  -e INPUT_DAYS=7 \
  github-activity-digest
```

## 🏗️ Architecture

### Technology Stack
- **Runtime**: Bun (10-100x faster I/O than Node.js)
- **Language**: TypeScript with strict mode
- **Validation**: Zod schemas for runtime type safety
- **CLI**: Citty for declarative argument parsing
- **Testing**: Bun test with comprehensive coverage
- **Logging**: Consola for beautiful CLI output

### Key Design Decisions
1. **Zod Schemas**: Eliminate manual validation with declarative schemas
2. **Citty CLI**: Auto-generated help, type validation, clean API
3. **Modular Architecture**: Each file has single responsibility
4. **Bun Native APIs**: `Bun.file()`, `Bun.write()` for performance
5. **Smart Caching**: 30min TTL reduces redundant API calls
6. **Retry Logic**: Exponential backoff handles transient failures

## 🌍 Multi-Language Support

Change the output language in your prompt template or config:

```json
{
  "output": {
    "language": "Portuguese"
  }
}
```

The AI will generate summaries in your specified language.

## 💡 Use Cases

- **Team Standups** - Automated weekly progress reports
- **Open Source Tracking** - Monitor contributions across projects
- **Organization Metrics** - Bird's-eye view of all development
- **Technology Monitoring** - Follow specific tech ecosystems via topics
- **Multi-Repo Projects** - Unified view of related repositories

## 🔧 Troubleshooting

**No repositories found:**
- Verify `GITHUB_TOKEN` has required scopes (`repo`, `read:org`)
- Check organization/user name spelling
- Ensure you have access to the repositories

**AI API errors:**
- Confirm API key is valid and set in `.env`
- Check you have credits/quota available
- Verify model name matches provider (e.g., `claude-sonnet-4-20250514`)

**Empty or sparse summaries:**
- Increase time period: `--days 30`
- Verify repositories had activity in the period
- Check filters aren't excluding active repos

**Slow performance:**
- Check cache is working (look for "Using cached" messages)
- Reduce number of repositories being processed
- Verify network connectivity

**Rate limit errors:**
- GitHub: Increase `GITHUB_TOKEN` rate limits (use authenticated requests)
- AI providers: Wait for quota reset or upgrade plan
- Retry logic handles transient errors automatically

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Add tests for new features
4. Ensure tests pass (`bun test`)
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Credits

Built with:
- [Bun](https://bun.sh) - Fast JavaScript runtime with native TypeScript
- [@octokit/rest](https://github.com/octokit/rest.js) - GitHub REST API client
- [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) - Claude AI integration
- [consola](https://github.com/unjs/consola) - Elegant console logging

---

Made with ❤️ for better team visibility
