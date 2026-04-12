FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json tsconfig.json nest-cli.json ./
RUN pnpm install --frozen-lockfile
COPY src ./src
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/package.json ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
EXPOSE 3011
CMD ["node", "dist/main"]
