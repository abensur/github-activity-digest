# GitHub Activity Digest

An intelligent, AI-powered tool that generates comprehensive weekly summaries of GitHub repository activity. Perfect for team updates, progress tracking, and organization-wide visibility.

Built with **TypeScript** and **Bun** for blazing-fast performance and excellent developer experience.

## ✨ Features

- **🎯 Flexible Repository Sources** - Organizations, users, topics, custom lists, or files
- **🤖 Multi-AI Support** - Anthropic Claude or OpenAI GPT
- **📊 Comprehensive Tracking** - Merged PRs, direct commits, and code statistics
- **⚡ High Performance** - Parallel processing, smart caching (30min TTL), automatic retry
- **🔧 Highly Configurable** - JSON config, environment variables, or CLI arguments
- **📝 Customizable Prompts** - Full control over AI output and language
- **🧪 Tested & Typed** - Full TypeScript with unit tests
- **🚀 Zero Build Required** - Bun runs TypeScript natively

## 🚀 Quick Start

### Installation

```bash
# Install Bun (if needed)
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone <your-repo-url>
cd github-activity-digest
bun install
```

### Setup

```bash
# Create config files
cp .env.example .env
cp config.example.json config.json
cp prompt-template.example.txt prompt-template.txt

# Add your tokens to .env
GITHUB_TOKEN=ghp_your_token_here
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

### Run

```bash
# Quick start with CLI args
bun start -- --user torvalds --days 7

# Or configure config.json and run
bun start
```

## 📖 Usage Examples

```bash
# Track organization repos
bun start -- --org vercel --days 7

# Track any GitHub user
bun start -- --user gaearon --days 30

# Track by topics
bun start -- --topics nextjs,react,typescript

# Use a custom list
bun start -- --file my-repos.txt

# Force refresh (bypass cache to get latest commits)
bun start -- --user torvalds --days 7 --no-cache
```

## ⚙️ Configuration

### config.json

```json
{
  "mode": "organization",
  "source": { "organization": "your-org" },
  "filters": {
    "excludeRepos": ["archived-", "test-"],
    "includeRepos": ["api-", "app-"]
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

## 🔑 Authentication

### GitHub Token

Required scopes:
- `repo` - Access repositories
- `read:org` - Read organization data (for organization mode)

[Create token →](https://github.com/settings/tokens/new?scopes=repo,read:org)

### AI Provider Keys

- **Anthropic**: [Get API key →](https://console.anthropic.com/settings/keys)
- **OpenAI**: [Get API key →](https://platform.openai.com/api-keys)

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
Activity data is cached for 30 minutes to reduce API calls and improve performance. The cache is automatically managed - no configuration needed.

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
    "onlyPrivate": false
  }
}
```

## 🤖 GitHub Actions

Automate weekly summaries with GitHub Actions.

### Setup

1. **Add API Key to Secrets:**
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` if using OpenAI)

2. **Create Workflow File:**

Create `.github/workflows/weekly-summary.yml`:

```yaml
name: Weekly Activity Summary

on:
  schedule:
    - cron: '0 10 * * 5'  # Every Friday at 10:00 AM UTC
  workflow_dispatch:       # Allows manual trigger from GitHub UI

jobs:
  generate-summary:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Generate summary
        run: bun start
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Auto-provided by GitHub
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          # Or use: OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Upload summary
        uses: actions/upload-artifact@v4
        with:
          name: weekly-summary-${{ github.run_number }}
          path: archive/*.md
          retention-days: 90
```

**Notes:**
- `GITHUB_TOKEN` is automatically provided by GitHub Actions (no setup needed)
- The workflow can be triggered manually from the Actions tab
- Summaries are saved as artifacts for 90 days
- Adjust the cron schedule to your preferred timing ([crontab.guru](https://crontab.guru) for help)

## 📂 Project Structure

```
github-activity-digest/
├── index.ts                     # Main entry point (Citty CLI)
├── lib/
│   ├── config.ts                # Config loading with Zod validation
│   ├── ai.ts                    # Multi-provider AI client
│   ├── github.ts                # Repository fetching
│   ├── activity.ts              # Activity tracking & stats
│   ├── retry.ts                 # Exponential backoff logic
│   ├── cache.ts                 # In-memory caching (30min TTL)
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

# Watch mode (auto-restart on changes)
bun --watch index.ts
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
