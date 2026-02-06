#!/bin/sh
set -e

# Build CLI arguments from action inputs
ARGS=""

# Mode-specific arguments
case "$INPUT_MODE" in
  organization)
    if [ -n "$INPUT_ORGANIZATION" ]; then
      ARGS="$ARGS --org $INPUT_ORGANIZATION"
    fi
    ;;
  user)
    if [ -n "$INPUT_USER" ]; then
      ARGS="$ARGS --user $INPUT_USER"
    fi
    ;;
  topics)
    if [ -n "$INPUT_TOPICS" ]; then
      ARGS="$ARGS --topics $INPUT_TOPICS"
    fi
    ;;
  list)
    if [ -n "$INPUT_REPOSITORIES" ]; then
      ARGS="$ARGS --repos $INPUT_REPOSITORIES"
    fi
    ;;
esac

# Common arguments
if [ -n "$INPUT_DAYS" ]; then
  ARGS="$ARGS --days $INPUT_DAYS"
fi

# Set environment variables for config overrides
export MODE="$INPUT_MODE"
export PERIOD_DAYS="$INPUT_DAYS"

if [ -n "$INPUT_AI_PROVIDER" ]; then
  export AI_PROVIDER="$INPUT_AI_PROVIDER"
fi

if [ -n "$INPUT_AI_MODEL" ]; then
  export AI_MODEL="$INPUT_AI_MODEL"
fi

if [ -n "$INPUT_LANGUAGE" ]; then
  export OUTPUT_LANGUAGE="$INPUT_LANGUAGE"
fi

if [ -n "$INPUT_ARCHIVE_DIR" ]; then
  export ARCHIVE_DIR="$INPUT_ARCHIVE_DIR"
fi

# Create dynamic config for filters
if [ -n "$INPUT_EXCLUDE_REPOS" ] || [ -n "$INPUT_INCLUDE_REPOS" ] || \
   [ "$INPUT_ONLY_PUBLIC" = "true" ] || [ "$INPUT_ONLY_PRIVATE" = "true" ] || \
   [ -n "$INPUT_MAX_REPOS" ]; then
  
  cat > /tmp/action-config.json << EOF
{
  "filters": {
    "excludeRepos": $(echo "$INPUT_EXCLUDE_REPOS" | jq -R 'split(",") | map(select(length > 0))'),
    "includeRepos": $(echo "$INPUT_INCLUDE_REPOS" | jq -R 'split(",") | map(select(length > 0))'),
    "onlyPublic": $INPUT_ONLY_PUBLIC,
    "onlyPrivate": $INPUT_ONLY_PRIVATE,
    "maxRepos": ${INPUT_MAX_REPOS:-500}
  }
}
EOF
fi

echo "::group::Running GitHub Activity Digest"
echo "Mode: $INPUT_MODE"
echo "Days: $INPUT_DAYS"
echo "AI Provider: $INPUT_AI_PROVIDER"
echo "::endgroup::"

# Run the digest and capture output
OUTPUT_FILE="/tmp/summary-output.md"
bun run /app/index.ts $ARGS 2>&1 | tee /tmp/run-output.txt

# Find the generated summary file
TIMESTAMP=$(date +%Y-%m-%d)
SUMMARY_FILE="${INPUT_ARCHIVE_DIR:-archive}/weekly-report-${TIMESTAMP}.md"

# Set outputs for GitHub Actions
if [ -f "$SUMMARY_FILE" ]; then
  # Escape multiline content for GitHub Actions
  SUMMARY_CONTENT=$(cat "$SUMMARY_FILE")
  
  # Use heredoc for multiline output
  {
    echo "summary<<EOF"
    echo "$SUMMARY_CONTENT"
    echo "EOF"
  } >> "$GITHUB_OUTPUT"
  
  echo "summary-file=$SUMMARY_FILE" >> "$GITHUB_OUTPUT"
  echo "✅ Summary saved to: $SUMMARY_FILE"
else
  echo "⚠️ No summary file generated"
fi

# Count repos from output
REPOS_PROCESSED=$(grep -oE "Processed [0-9]+ repositories" /tmp/run-output.txt | grep -oE "[0-9]+" || echo "0")
ACTIVE_REPOS=$(grep -oE "Activity found in [0-9]+ repositories" /tmp/run-output.txt | grep -oE "[0-9]+" || echo "0")

echo "repos-processed=$REPOS_PROCESSED" >> "$GITHUB_OUTPUT"
echo "active-repos=$ACTIVE_REPOS" >> "$GITHUB_OUTPUT"

echo "::notice::Processed $REPOS_PROCESSED repositories, $ACTIVE_REPOS with activity"
