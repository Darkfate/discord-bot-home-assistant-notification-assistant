# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-builder

WORKDIR /app/server

# Copy server package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci

# Copy server source
COPY server/ ./

# Build server
RUN npm run build

# Stage 3: Production
FROM node:20-alpine

WORKDIR /app

# Install production dependencies for server
COPY server/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy server build
COPY --from=server-builder /app/server/dist ./dist

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "dist/index.js"]
