# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY packages/common/package.json ./packages/common/
COPY packages/types/package.json ./packages/types/
COPY services/orchestration-service/package.json ./services/orchestration-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/common ./packages/common
COPY packages/types ./packages/types
COPY services/orchestration-service ./services/orchestration-service
COPY tsconfig.json ./
COPY prisma ./prisma

# Build packages
RUN pnpm --filter @multi-agent/types build
RUN pnpm --filter @multi-agent/common build

# Generate Prisma client
RUN cd prisma && npx prisma generate

# Build orchestration service
RUN pnpm --filter @multi-agent/orchestration-service build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/common/package.json ./packages/common/
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/services/orchestration-service/package.json ./services/orchestration-service/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/services/orchestration-service/dist ./services/orchestration-service/dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set environment
ENV NODE_ENV=production

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "services/orchestration-service/dist/main.js"]
