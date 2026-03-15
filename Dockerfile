# Ethereum Immersive Trainer - Docker Image
# Supports two modes: instructor (full blockchain node) and student (frontend only)

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Copy lab docs so they're served at /docs/*.md and displayed in GUI
COPY docs/ ./public/docs/

# Build frontend for production
RUN npm run build

# ============================================
# Stage 2: Build CLI Labs
# ============================================
FROM node:20-alpine AS cli-builder

WORKDIR /app/scripts/cli-labs/standalone

# Copy CLI labs package files
COPY scripts/cli-labs/standalone/package*.json ./
RUN npm ci --only=production

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:20-alpine

LABEL maintainer="Ethereum Immersive Trainer"
LABEL description="Interactive blockchain training environment"

WORKDIR /app

# Install curl for health checks, bash for scripts, build deps for node-pty
RUN apk add --no-cache curl bash python3 make g++

# Copy blockchain dependencies (needed for instructor mode)
# Use --ignore-scripts to skip postinstall (frontend is built separately)
COPY package*.json ./
RUN npm ci --ignore-scripts && npm rebuild node-pty

# Copy blockchain contracts and scripts
COPY contracts/ ./contracts/
COPY scripts/ ./scripts/
COPY indexer/ ./indexer/
COPY server/ ./server/
COPY hardhat.config.js ./

# Copy CLI labs with pre-installed dependencies
COPY --from=cli-builder /app/scripts/cli-labs/standalone/node_modules ./scripts/cli-labs/standalone/node_modules

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Install serve for static file hosting
RUN npm install -g serve

# Create directories for runtime data
RUN mkdir -p /app/data /app/contracts/student /app/frontend/public

# Copy startup scripts and configs
COPY docker-entrypoint.sh /usr/local/bin/
COPY instructor-config.json student-config.json ./
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Environment variables
ENV MODE=instructor
ENV RPC_PORT=8545
ENV FRONTEND_PORT=5173
ENV CONTRACT_ADDRESS=""
ENV INSTRUCTOR_RPC_URL=""

# Expose ports (8545=RPC, 5173=frontend, 3001=indexer, 3002-3004=Lab Terminal)
EXPOSE 8545 5173 3001 3002 3003 3004

# Health check - checks frontend availability
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${FRONTEND_PORT}/ || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
