FROM oven/bun:1-alpine

LABEL org.opencontainers.image.source="https://github.com/abensur/github-activity-digest"
LABEL org.opencontainers.image.description="AI-powered GitHub activity summarizer"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
