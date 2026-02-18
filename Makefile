# Makefile for Multi-Agent Platform Kubernetes Deployment

.PHONY: help setup build deploy dev prod clean status logs port-forward test validate prisma-generate prisma-migrate prisma-studio prisma-reset

# Default target
.DEFAULT_GOAL := help

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m # No Color

help: ## Show this help message
	@echo '$(GREEN)Multi-Agent Platform - Kubernetes Deployment$(NC)'
	@echo ''
	@echo 'Usage:'
	@echo '  make $(YELLOW)<target>$(NC)'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Setup local Kubernetes cluster (minikube)
	@echo "$(GREEN)Setting up local Kubernetes cluster...$(NC)"
	minikube start --cpus=4 --memory=8192 --disk-size=50g
	kubectl create namespace multi-agent || true
	@echo "$(GREEN)Installing NGINX Ingress Controller...$(NC)"
	kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
	@echo "$(GREEN)Installing Metrics Server...$(NC)"
	kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
	@echo "$(GREEN)Setup complete!$(NC)"

build: ## Build all Docker images
	@echo "$(GREEN)Building Docker images...$(NC)"
	skaffold build

deploy: ## Deploy all services to Kubernetes
	@echo "$(GREEN)Deploying to Kubernetes...$(NC)"
	skaffold run

dev: ## Run in development mode with hot reload
	@echo "$(GREEN)Starting development mode...$(NC)"
	skaffold dev

prod: ## Deploy to production
	@echo "$(GREEN)Deploying to production...$(NC)"
	skaffold run -p prod

clean: ## Delete all Kubernetes resources
	@echo "$(RED)Cleaning up Kubernetes resources...$(NC)"
	skaffold delete || true
	kubectl delete namespace multi-agent || true
	@echo "$(GREEN)Cleanup complete!$(NC)"

status: ## Show status of all resources
	@echo "$(GREEN)Kubernetes Resources Status:$(NC)"
	@echo ""
	@echo "$(YELLOW)Namespace:$(NC)"
	kubectl get namespace multi-agent
	@echo ""
	@echo "$(YELLOW)Pods:$(NC)"
	kubectl get pods -n multi-agent
	@echo ""
	@echo "$(YELLOW)Services:$(NC)"
	kubectl get svc -n multi-agent
	@echo ""
	@echo "$(YELLOW)Deployments:$(NC)"
	kubectl get deployments -n multi-agent
	@echo ""
	@echo "$(YELLOW)StatefulSets:$(NC)"
	kubectl get statefulsets -n multi-agent
	@echo ""
	@echo "$(YELLOW)HPA:$(NC)"
	kubectl get hpa -n multi-agent
	@echo ""
	@echo "$(YELLOW)Ingress:$(NC)"
	kubectl get ingress -n multi-agent

logs: ## Show logs from all services
	@echo "$(GREEN)Streaming logs from all pods...$(NC)"
	kubectl logs -f -n multi-agent -l component=api --max-log-requests=10 --prefix=true

logs-gateway: ## Show logs from gateway service
	kubectl logs -f -n multi-agent -l app=gateway-service

logs-orchestration: ## Show logs from orchestration service
	kubectl logs -f -n multi-agent -l app=orchestration-service

logs-agent: ## Show logs from agent service
	kubectl logs -f -n multi-agent -l app=agent-service

logs-frontend: ## Show logs from frontend
	kubectl logs -f -n multi-agent -l app=frontend

port-forward: ## Forward ports for local access
	@echo "$(GREEN)Setting up port forwarding...$(NC)"
	@echo "Gateway:      http://localhost:3000"
	@echo "Frontend:     http://localhost:3001"
	@echo "PostgreSQL:   localhost:5432"
	@echo "Qdrant:       http://localhost:6333"
	@echo "NATS:         nats://localhost:4222"
	@echo ""
	@echo "Press Ctrl+C to stop"
	@(kubectl port-forward -n multi-agent svc/gateway-service 3000:3000 & \
	  kubectl port-forward -n multi-agent svc/frontend 3001:3001 & \
	  kubectl port-forward -n multi-agent svc/postgres 5432:5432 & \
	  kubectl port-forward -n multi-agent svc/qdrant 6333:6333 & \
	  kubectl port-forward -n multi-agent svc/nats 4222:4222 & \
	  wait)

test: ## Run tests
	@echo "$(GREEN)Running tests...$(NC)"
	# Add test commands here

# Database commands (via packages/database)
prisma-generate: ## Generate Prisma client
	@echo "$(GREEN)Generating Prisma client...$(NC)"
	pnpm prisma:generate

prisma-migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	pnpm prisma:migrate

prisma-studio: ## Open Prisma Studio
	@echo "$(GREEN)Opening Prisma Studio...$(NC)"
	pnpm prisma:studio

prisma-reset: ## Reset database (WARNING: destroys data)
	@echo "$(RED)Resetting database...$(NC)"
	pnpm --filter @multi-agent/database exec prisma migrate reset

validate: ## Validate Kubernetes manifests
	@echo "$(GREEN)Validating Kubernetes manifests...$(NC)"
	@for file in k8s/*.yaml k8s/*/*.yaml; do \
		echo "Validating $$file..."; \
		kubectl apply --dry-run=client -f $$file > /dev/null || exit 1; \
	done
	@echo "$(GREEN)All manifests are valid!$(NC)"

describe: ## Describe pods (usage: make describe POD=<pod-name>)
	@if [ -z "$(POD)" ]; then \
		echo "$(RED)Error: POD variable not set$(NC)"; \
		echo "Usage: make describe POD=<pod-name>"; \
		exit 1; \
	fi
	kubectl describe pod $(POD) -n multi-agent

exec: ## Execute command in pod (usage: make exec POD=<pod-name> CMD=<command>)
	@if [ -z "$(POD)" ]; then \
		echo "$(RED)Error: POD variable not set$(NC)"; \
		echo "Usage: make exec POD=<pod-name> CMD=<command>"; \
		exit 1; \
	fi
	kubectl exec -it $(POD) -n multi-agent -- $(or $(CMD),/bin/sh)

restart: ## Restart a deployment (usage: make restart DEPLOY=<deployment-name>)
	@if [ -z "$(DEPLOY)" ]; then \
		echo "$(RED)Error: DEPLOY variable not set$(NC)"; \
		echo "Usage: make restart DEPLOY=<deployment-name>"; \
		exit 1; \
	fi
	kubectl rollout restart deployment/$(DEPLOY) -n multi-agent

scale: ## Scale a deployment (usage: make scale DEPLOY=<name> REPLICAS=<number>)
	@if [ -z "$(DEPLOY)" ] || [ -z "$(REPLICAS)" ]; then \
		echo "$(RED)Error: DEPLOY or REPLICAS variable not set$(NC)"; \
		echo "Usage: make scale DEPLOY=<deployment-name> REPLICAS=<number>"; \
		exit 1; \
	fi
	kubectl scale deployment/$(DEPLOY) -n multi-agent --replicas=$(REPLICAS)

events: ## Show recent events
	kubectl get events -n multi-agent --sort-by='.lastTimestamp'

top: ## Show resource usage
	@echo "$(YELLOW)Pod Resource Usage:$(NC)"
	kubectl top pods -n multi-agent
	@echo ""
	@echo "$(YELLOW)Node Resource Usage:$(NC)"
	kubectl top nodes

update-secrets: ## Update secrets (after editing secrets.yaml)
	@echo "$(YELLOW)Updating secrets...$(NC)"
	kubectl delete secret multi-agent-secrets postgres-secret -n multi-agent || true
	kubectl apply -f k8s/secrets.yaml
	@echo "$(GREEN)Secrets updated! Restart deployments to use new secrets.$(NC)"

update-configmaps: ## Update configmaps
	@echo "$(YELLOW)Updating configmaps...$(NC)"
	kubectl delete configmap multi-agent-config frontend-config -n multi-agent || true
	kubectl apply -f k8s/configmaps.yaml
	@echo "$(GREEN)ConfigMaps updated! Restart deployments to use new config.$(NC)"

dashboard: ## Open Kubernetes dashboard
	@echo "$(GREEN)Opening Kubernetes dashboard...$(NC)"
	minikube dashboard

ingress-hosts: ## Add ingress hosts to /etc/hosts
	@echo "$(YELLOW)Add these lines to /etc/hosts:$(NC)"
	@echo ""
	@echo "127.0.0.1 multi-agent.local api.multi-agent.local"
	@echo ""
	@echo "Then run: minikube tunnel"

tunnel: ## Start minikube tunnel for LoadBalancer services
	@echo "$(GREEN)Starting minikube tunnel (requires sudo)...$(NC)"
	minikube tunnel

backup-db: ## Backup PostgreSQL database
	@echo "$(GREEN)Backing up database...$(NC)"
	kubectl exec -n multi-agent $$(kubectl get pod -n multi-agent -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- \
		pg_dump -U postgres multi_agent > backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "$(GREEN)Backup complete!$(NC)"

restore-db: ## Restore PostgreSQL database (usage: make restore-db FILE=<backup-file>)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: FILE variable not set$(NC)"; \
		echo "Usage: make restore-db FILE=<backup-file>"; \
		exit 1; \
	fi
	kubectl exec -i -n multi-agent $$(kubectl get pod -n multi-agent -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- \
		psql -U postgres multi_agent < $(FILE)
	@echo "$(GREEN)Restore complete!$(NC)"

# Development helpers
dev-frontend: ## Develop frontend locally with port-forward
	kubectl port-forward -n multi-agent svc/gateway-service 3000:3000 &
	cd frontend && npm run dev

check-health: ## Check health of all services
	@echo "$(GREEN)Checking service health...$(NC)"
	@echo ""
	@for svc in gateway-service orchestration-service agent-service tool-service model-service vector-service execution-service frontend; do \
		echo "$(YELLOW)Checking $$svc...$(NC)"; \
		kubectl get pods -n multi-agent -l app=$$svc -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\t"}{range .status.containerStatuses[*]}{.ready}{" "}{end}{"\n"}{end}'; \
		echo ""; \
	done
