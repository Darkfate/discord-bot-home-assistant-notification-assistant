# Stage 1: Build bot service
FROM node:20-alpine AS bot-builder

WORKDIR /app

# Copy bot package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy bot source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Build sandbox frontend
FROM node:20-alpine AS sandbox-builder

WORKDIR /app

# Copy sandbox frontend package files
COPY sandbox/frontend/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy sandbox frontend source
COPY sandbox/frontend ./

# Build frontend
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine

WORKDIR /app

# Install su-exec for running as different user
RUN apk add --no-cache su-exec

# Copy bot dependencies and build
COPY --from=bot-builder /app/package*.json ./
COPY --from=bot-builder /app/node_modules ./node_modules
COPY --from=bot-builder /app/dist ./dist

# Copy sandbox frontend build
COPY --from=sandbox-builder /app/dist ./sandbox-dist

# Create data directory
RUN mkdir -p data

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory (but not data - that will be mounted)
RUN chown -R nodejs:nodejs /app

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose webhook port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Set entrypoint to fix permissions and switch to nodejs user
ENTRYPOINT ["docker-entrypoint.sh"]

# Run the bot
CMD ["npm", "start"]
