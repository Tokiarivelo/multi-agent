.PHONY: help install dev build start test lint clean docker-build docker-up docker-down prisma-generate

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	pnpm install

dev: ## Start development server
	pnpm start:dev

build: ## Build for production
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

docker-build: ## Build Docker image
	docker-compose build

docker-up: ## Start Docker containers
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f tool-service

docker-clean: ## Remove Docker containers and volumes
	docker-compose down -v
