# =========================================================================
# Multi-Stage Production Dockerfile for Secure File Vault
# =========================================================================

# Stage 1: Build Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend Services & Prisma Client
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm install
RUN npx prisma generate

COPY backend/ ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install curl for container health check & openssl for Prisma runtime
RUN apk add --no-cache curl openssl

ENV NODE_ENV=production
ENV PORT=5000
ENV CLIENT_DIST_PATH=/app/frontend/dist
ENV STORAGE_PATH=/app/storage

# Install production dependencies only
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate

# Copy compiled backend & frontend
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create storage directory for encrypted vaults
RUN mkdir -p /app/storage && chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]
