.PHONY: help install build start start-dev start-prod test lint docker-build docker-up docker-down db-migrate db-reset clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	pnpm install

build: ## Build the project
	pnpm run build

start: ## Start the application
	pnpm run start

start-dev: ## Start in development mode
	pnpm run start:dev

start-prod: build ## Start in production mode
	pnpm run start:prod

test: ## Run tests
	pnpm run test

test-e2e: ## Run e2e tests
	pnpm run test:e2e

test-cov: ## Run tests with coverage
	pnpm run test:cov

lint: ## Lint the code
	pnpm run lint

docker-build: ## Build Docker image
	docker build -t agent-service:latest .

docker-up: ## Start services with Docker Compose
	docker-compose up -d

docker-down: ## Stop services with Docker Compose
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

db-generate: ## Generate Prisma client
	pnpm run prisma:generate

db-migrate: ## Run database migrations
	npx prisma migrate dev

db-reset: ## Reset database
	npx prisma migrate reset

db-studio: ## Open Prisma Studio
	npx prisma studio

clean: ## Clean build artifacts
	rm -rf dist node_modules coverage

dev-setup: install db-generate db-migrate ## Setup development environment
	@echo "Development environment ready!"
