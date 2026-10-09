# ==============================================================================
# HACKBRIDGE PRODUCTION DOCKERFILE
# Multi-Stage Build: Node.js 20 Alpine Builder -> Nginx Alpine Production Server
# ==============================================================================

# Stage 1: Build Frontend SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (utilizing Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build production bundle with optimized tree-shaking
RUN npm run build

# Stage 2: High-Performance Production Nginx Runtime
FROM nginx:1.25-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built SPA artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for SPA routing & security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check to ensure nginx is serving requests
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
