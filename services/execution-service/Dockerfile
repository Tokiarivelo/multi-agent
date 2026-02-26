FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./

# Install pnpm
RUN npm install -g pnpm@8.14.0

# Copy workspace packages
COPY packages ./packages
COPY services/execution-service ./services/execution-service

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the service
WORKDIR /app/services/execution-service
RUN pnpm build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm
RUN npm install -g pnpm@8.14.0

# Copy workspace packages (built)
COPY --from=builder /app/packages ./packages

# Copy built service
COPY --from=builder /app/services/execution-service/dist ./services/execution-service/dist
COPY --from=builder /app/services/execution-service/package.json ./services/execution-service/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/services/execution-service

EXPOSE 3003

CMD ["node", "dist/main.js"]
