.PHONY: help install dev build test lint clean docker-up docker-down prisma-generate prisma-migrate

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	pnpm install

dev: ## Start development server
	pnpm start:dev

build: ## Build the application
	pnpm build

start: ## Start production server
	pnpm start:prod

test: ## Run tests
	pnpm test

test-watch: ## Run tests in watch mode
	pnpm test:watch

test-cov: ## Run tests with coverage
	pnpm test:cov

lint: ## Run linter
	pnpm lint

clean: ## Clean build artifacts
	rm -rf dist node_modules coverage

prisma-generate: ## Generate Prisma client
	pnpm prisma:generate

prisma-migrate: ## Run Prisma migrations
	pnpm prisma:migrate

prisma-studio: ## Open Prisma Studio
	pnpm prisma:studio

docker-build: ## Build Docker image
	docker build -t model-service:latest .

docker-up: ## Start Docker containers
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f model-service

docker-clean: ## Clean Docker containers and volumes
	docker-compose down -v
