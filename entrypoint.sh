#!/bin/sh
set -e

# Debug: show what inputs we received
echo "::group::Debug - Environment Variables"
env | grep -E "^INPUT_" || echo "No INPUT_ variables found"
echo "::endgroup::"

# Default values (GitHub Actions passes inputs as INPUT_* env vars)
MODE="${INPUT_MODE:-organization}"
ORGANIZATION="${INPUT_ORGANIZATION:-}"
USER="${INPUT_USER:-}"
TOPICS="${INPUT_TOPICS:-}"
REPOSITORIES="${INPUT_REPOSITORIES:-}"
DAYS="${INPUT_DAYS:-7}"
AI_PROVIDER="${INPUT_AI_PROVIDER:-anthropic}"
AI_MODEL="${INPUT_AI_MODEL:-claude-sonnet-4-20250514}"
LANGUAGE="${INPUT_LANGUAGE:-English}"
ARCHIVE_DIR="${INPUT_ARCHIVE_DIR:-archive}"
MAX_REPOS="${INPUT_MAX_REPOS:-500}"
EXCLUDE_REPOS="${INPUT_EXCLUDE_REPOS:-}"
INCLUDE_REPOS="${INPUT_INCLUDE_REPOS:-}"
ONLY_PUBLIC="${INPUT_ONLY_PUBLIC:-false}"
ONLY_PRIVATE="${INPUT_ONLY_PRIVATE:-false}"
OUTPUT_FORMAT="${INPUT_OUTPUT_FORMAT:-markdown}"
SLACK_WEBHOOK="${INPUT_SLACK_WEBHOOK:-}"
DISCORD_WEBHOOK="${INPUT_DISCORD_WEBHOOK:-}"

# Build CLI arguments from action inputs
ARGS=""

# Mode-specific arguments
case "$MODE" in
  organization)
    if [ -n "$ORGANIZATION" ]; then
      ARGS="$ARGS --org $ORGANIZATION"
    fi
    ;;
  user)
    if [ -n "$USER" ]; then
      ARGS="$ARGS --user $USER"
    fi
    ;;
  topics)
    if [ -n "$TOPICS" ]; then
      ARGS="$ARGS --topics $TOPICS"
    fi
    ;;
  list)
    if [ -n "$REPOSITORIES" ]; then
      ARGS="$ARGS --repos $REPOSITORIES"
    fi
    ;;
esac

# Common arguments
if [ -n "$DAYS" ]; then
  ARGS="$ARGS --days $DAYS"
fi

# Set environment variables for config overrides
export MODE
export PERIOD_DAYS="$DAYS"
export AI_PROVIDER
export AI_MODEL
export OUTPUT_LANGUAGE="$LANGUAGE"
export ARCHIVE_DIR

# Create dynamic config for filters (only if jq is available)
if command -v jq >/dev/null 2>&1; then
  if [ -n "$EXCLUDE_REPOS" ] || [ -n "$INCLUDE_REPOS" ] || \
     [ "$ONLY_PUBLIC" = "true" ] || [ "$ONLY_PRIVATE" = "true" ] || \
     [ -n "$MAX_REPOS" ]; then

    cat > /tmp/action-config.json << EOF
{
  "filters": {
    "excludeRepos": $(echo "$EXCLUDE_REPOS" | jq -R 'split(",") | map(select(length > 0))'),
    "includeRepos": $(echo "$INCLUDE_REPOS" | jq -R 'split(",") | map(select(length > 0))'),
    "onlyPublic": $ONLY_PUBLIC,
    "onlyPrivate": $ONLY_PRIVATE,
    "maxRepos": ${MAX_REPOS:-500}
  }
}
EOF
  fi
fi

echo "::group::Running GitHub Activity Digest"
echo "Mode: $MODE"
echo "Days: $DAYS"
echo "AI Provider: $AI_PROVIDER"
echo "Args: $ARGS"
echo "::endgroup::"

# Run the digest and capture output
OUTPUT_FILE="/tmp/summary-output.md"
bun run /app/index.ts $ARGS 2>&1 | tee /tmp/run-output.txt

# Find the generated summary file
TIMESTAMP=$(date +%Y-%m-%d)
SUMMARY_FILE="${ARCHIVE_DIR}/weekly-report-${TIMESTAMP}.md"

# Set outputs for GitHub Actions (skip if not in Actions environment)
if [ -f "$SUMMARY_FILE" ]; then
  echo "✅ Summary saved to: $SUMMARY_FILE"

  if [ -n "$GITHUB_OUTPUT" ]; then
    # Escape multiline content for GitHub Actions
    SUMMARY_CONTENT=$(cat "$SUMMARY_FILE")

    # Use heredoc for multiline output
    {
      echo "summary<<EOF"
      echo "$SUMMARY_CONTENT"
      echo "EOF"
    } >> "$GITHUB_OUTPUT"

    echo "summary-file=$SUMMARY_FILE" >> "$GITHUB_OUTPUT"
  fi
else
  echo "⚠️ No summary file generated"
fi

# Count repos from output
REPOS_PROCESSED=$(grep -oE "Found [0-9]+ repositories" /tmp/run-output.txt | grep -oE "[0-9]+" | head -1 || echo "0")
ACTIVE_REPOS=$(grep -oE "Activity found in [0-9]+ repositories" /tmp/run-output.txt | grep -oE "[0-9]+" | head -1 || echo "0")

if [ -n "$GITHUB_OUTPUT" ]; then
  echo "repos-processed=$REPOS_PROCESSED" >> "$GITHUB_OUTPUT"
  echo "active-repos=$ACTIVE_REPOS" >> "$GITHUB_OUTPUT"
  echo "::notice::Processed $REPOS_PROCESSED repositories, $ACTIVE_REPOS with activity"
else
  echo "📊 Processed $REPOS_PROCESSED repositories, $ACTIVE_REPOS with activity"
fi

# Generate JSON output if requested
if [ "$OUTPUT_FORMAT" = "json" ] || [ "$OUTPUT_FORMAT" = "both" ]; then
  JSON_FILE="${ARCHIVE_DIR}/weekly-report-${TIMESTAMP}.json"
  if [ -f "$SUMMARY_FILE" ]; then
    jq -n \
      --arg summary "$(cat "$SUMMARY_FILE")" \
      --arg date "$TIMESTAMP" \
      --argjson repos_processed "$REPOS_PROCESSED" \
      --argjson active_repos "$ACTIVE_REPOS" \
      '{
        date: $date,
        repos_processed: $repos_processed,
        active_repos: $active_repos,
        summary: $summary
      }' > "$JSON_FILE"
    echo "📄 JSON saved to: $JSON_FILE"
    if [ -n "$GITHUB_OUTPUT" ]; then
      echo "json-file=$JSON_FILE" >> "$GITHUB_OUTPUT"
    fi
  fi
fi

# Send to Slack if webhook provided
if [ -n "$SLACK_WEBHOOK" ] && [ -f "$SUMMARY_FILE" ]; then
  echo "📤 Sending to Slack..."
  SLACK_PAYLOAD=$(jq -n --arg text "$(cat "$SUMMARY_FILE")" '{text: $text}')
  curl -s -X POST -H 'Content-type: application/json' \
    --data "$SLACK_PAYLOAD" \
    "$SLACK_WEBHOOK" > /dev/null && echo "✅ Slack notification sent" || echo "⚠️ Slack notification failed"
fi

# Send to Discord if webhook provided
if [ -n "$DISCORD_WEBHOOK" ] && [ -f "$SUMMARY_FILE" ]; then
  echo "📤 Sending to Discord..."
  # Discord has 2000 char limit per message, truncate if needed
  SUMMARY_TEXT=$(cat "$SUMMARY_FILE" | head -c 1900)
  DISCORD_PAYLOAD=$(jq -n --arg content "$SUMMARY_TEXT" '{content: $content}')
  curl -s -X POST -H 'Content-type: application/json' \
    --data "$DISCORD_PAYLOAD" \
    "$DISCORD_WEBHOOK" > /dev/null && echo "✅ Discord notification sent" || echo "⚠️ Discord notification failed"
fi
