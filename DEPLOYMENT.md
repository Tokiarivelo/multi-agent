# Deployment Guide

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Local Docker Deployment](#local-docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Migrations](#database-migrations)
- [Secrets Management](#secrets-management)
- [Monitoring and Logging](#monitoring-and-logging)
- [CI/CD Setup](#cicd-setup)
- [Backup and Recovery](#backup-and-recovery)

## Overview

The Multi-Agent Platform can be deployed in multiple ways:
- **Local Docker**: For development and testing
- **Kubernetes**: For production-ready deployments
- **Cloud Providers**: AWS, GCP, Azure (future support)

## Prerequisites

### Local Deployment
- Docker >= 24.0.0
- Docker Compose >= 2.0.0
- Node.js >= 20.0.0 (for building)
- pnpm >= 8.0.0 (for building)

### Kubernetes Deployment
- kubectl configured
- Kubernetes cluster (minikube, EKS, GKE, AKS)
- Skaffold (optional, for development)
- Helm (optional, for package management)

## Local Docker Deployment

### Build and Start Services

```bash
# Clone repository
git clone https://github.com/yourusername/multi-agent.git
cd multi-agent

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start infrastructure and services
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Individual Service Management

```bash
# Start specific service
docker-compose up -d gateway-service

# View service logs
docker-compose logs -f gateway-service

# Restart service
docker-compose restart gateway-service

# Stop service
docker-compose stop gateway-service
```

### docker-compose.yml Structure

```yaml
version: '3.8'

services:
  # Infrastructure
  nats:
    image: nats:2.10-alpine
    ports:
      - "4222:4222"
    volumes:
      - nats-data:/data

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: multi_agent
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant-data:/qdrant/storage

  # Services (add as needed)
  gateway-service:
    build: ./services/gateway-service
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - nats

volumes:
  nats-data:
  postgres-data:
  qdrant-data:

networks:
  multi-agent:
    driver: bridge
```

## Kubernetes Deployment

### Using Makefile (Recommended)

```bash
# Start local cluster
make cluster-start

# Deploy all services
make deploy

# View status
make status

# Port forward to access services
make port-forward

# View logs
make logs SERVICE=gateway-service

# Clean up
make clean
```

### Manual Deployment with Skaffold

#### Development Mode (Hot Reload)

```bash
# Start minikube
minikube start --cpus=4 --memory=8192

# Enable ingress
minikube addons enable ingress

# Deploy with Skaffold (development mode)
skaffold dev
```

#### Production Mode

```bash
# Build and deploy
skaffold run

# Or specify a tag
skaffold run --tag=v1.0.0
```

### Manual Kubernetes Deployment

#### 1. Create Namespace

```bash
kubectl create namespace multi-agent
kubectl config set-context --current --namespace=multi-agent
```

#### 2. Create Secrets

```bash
# Database credentials
kubectl create secret generic postgres-secret \
  --from-literal=username=postgres \
  --from-literal=password=your-secure-password

# JWT secret
kubectl create secret generic jwt-secret \
  --from-literal=secret=your-jwt-secret

# Encryption key
kubectl create secret generic encryption-secret \
  --from-literal=key=your-encryption-key
```

#### 3. Deploy Infrastructure

```bash
# PostgreSQL
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml

# NATS
kubectl apply -f k8s/nats-deployment.yaml
kubectl apply -f k8s/nats-service.yaml

# Qdrant
kubectl apply -f k8s/qdrant-deployment.yaml
kubectl apply -f k8s/qdrant-service.yaml
```

#### 4. Deploy Services

```bash
# Gateway Service
kubectl apply -f k8s/gateway-deployment.yaml
kubectl apply -f k8s/gateway-service.yaml

# Agent Service
kubectl apply -f k8s/agent-deployment.yaml
kubectl apply -f k8s/agent-service.yaml

# Apply all other services
kubectl apply -f k8s/
```

#### 5. Verify Deployment

```bash
# Check pods
kubectl get pods

# Check services
kubectl get services

# Check deployments
kubectl get deployments

# View pod logs
kubectl logs -f deployment/gateway-service
```

#### 6. Access Services

```bash
# Port forward gateway
kubectl port-forward svc/gateway-service 3000:3000

# Port forward frontend
kubectl port-forward svc/frontend 3001:3001

# Or use ingress (if configured)
minikube service gateway-service --url
```

### Example Kubernetes Manifests

#### Deployment

```yaml
# k8s/gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway-service
  namespace: multi-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gateway-service
  template:
    metadata:
      labels:
        app: gateway-service
    spec:
      containers:
      - name: gateway-service
        image: multi-agent/gateway-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: connection-string
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        - name: NATS_URL
          value: "nats://nats:4222"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

#### Service

```yaml
# k8s/gateway-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: gateway-service
  namespace: multi-agent
spec:
  type: ClusterIP
  selector:
    app: gateway-service
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
```

#### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-agent-ingress
  namespace: multi-agent
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: api.multi-agent.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway-service
            port:
              number: 3000
```

## Production Deployment

### Container Registry Setup

#### Docker Hub

```bash
# Login
docker login

# Tag images
docker tag gateway-service:latest yourusername/gateway-service:v1.0.0

# Push images
docker push yourusername/gateway-service:v1.0.0
```

#### AWS ECR

```bash
# Authenticate
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag gateway-service:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/gateway-service:v1.0.0
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/gateway-service:v1.0.0
```

### Production Checklist

- [ ] Use production-grade database (not docker-compose postgres)
- [ ] Setup database backups
- [ ] Configure secrets management (Vault, AWS Secrets Manager)
- [ ] Setup monitoring (Prometheus, Grafana)
- [ ] Setup logging (ELK, CloudWatch)
- [ ] Configure autoscaling (HPA)
- [ ] Setup SSL/TLS certificates
- [ ] Configure ingress with load balancer
- [ ] Setup CI/CD pipeline
- [ ] Configure resource limits
- [ ] Enable network policies
- [ ] Setup disaster recovery plan

## Environment Configuration

### Production Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@prod-db.example.com:5432/multi_agent

# JWT
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=<32-byte-hex-key>

# NATS
NATS_URL=nats://nats-cluster.example.com:4222

# Qdrant
QDRANT_URL=https://qdrant.example.com
QDRANT_API_KEY=<api-key>

# Services
NODE_ENV=production
LOG_LEVEL=info

# CORS
CORS_ORIGIN=https://app.example.com
```

### ConfigMaps

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: multi-agent
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  NATS_URL: "nats://nats:4222"
  CORS_ORIGIN: "https://app.example.com"
```

## Database Migrations

### Running Migrations in Production

```bash
# Option 1: Job container
kubectl apply -f k8s/migration-job.yaml

# Option 2: Manual execution
kubectl run migration --image=multi-agent/gateway-service:latest \
  --restart=Never \
  --env="DATABASE_URL=$DATABASE_URL" \
  --command -- pnpm prisma:migrate

# Check job status
kubectl get jobs
kubectl logs job/migration
```

### Migration Job Example

```yaml
# k8s/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  namespace: multi-agent
spec:
  template:
    spec:
      containers:
      - name: migration
        image: multi-agent/gateway-service:latest
        command: ["npx", "prisma", "migrate", "deploy"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: connection-string
      restartPolicy: OnFailure
  backoffLimit: 3
```

## Secrets Management

### Using Kubernetes Secrets

```bash
# Create from literal
kubectl create secret generic api-keys \
  --from-literal=openai=sk-... \
  --from-literal=anthropic=sk-...

# Create from file
kubectl create secret generic tls-cert \
  --from-file=tls.crt=./cert.crt \
  --from-file=tls.key=./cert.key

# Use in deployment
env:
- name: OPENAI_API_KEY
  valueFrom:
    secretKeyRef:
      name: api-keys
      key: openai
```

### Using External Secrets (Recommended for Production)

```yaml
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets

# Create SecretStore
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretsmanager
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1

# Create ExternalSecret
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  secretStoreRef:
    name: aws-secretsmanager
  target:
    name: app-secrets
  data:
  - secretKey: jwt-secret
    remoteRef:
      key: prod/multi-agent/jwt-secret
```

## Monitoring and Logging

### Prometheus & Grafana

```bash
# Install Prometheus Stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack

# Access Grafana
kubectl port-forward svc/prometheus-grafana 3010:80

# Default credentials: admin / prom-operator
```

### Application Metrics

Add to your services:

```typescript
// Expose metrics endpoint
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

### ELK Stack (Elasticsearch, Logstash, Kibana)

```bash
# Install ELK
helm repo add elastic https://helm.elastic.co
helm install elasticsearch elastic/elasticsearch
helm install kibana elastic/kibana
helm install filebeat elastic/filebeat
```

## CI/CD Setup

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test

      - name: Build images
        run: docker-compose build

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker-compose push

      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v1
        with:
          manifests: |
            k8s/
          images: |
            yourusername/gateway-service:${{ github.sha }}
          kubectl-version: 'latest'
```

## Backup and Recovery

### Database Backup

```bash
# Backup PostgreSQL
kubectl exec -it postgres-pod -- pg_dump -U postgres multi_agent > backup.sql

# Restore PostgreSQL
kubectl exec -i postgres-pod -- psql -U postgres multi_agent < backup.sql

# Automated backup job
kubectl apply -f k8s/backup-cronjob.yaml
```

### CronJob Example

```yaml
# k8s/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:16-alpine
            command:
            - sh
            - -c
            - pg_dump -U postgres -h postgres multi_agent | gzip > /backup/backup-$(date +%Y%m%d).sql.gz
            volumeMounts:
            - name: backup
              mountPath: /backup
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

### Volume Backup

```bash
# Backup persistent volumes
kubectl get pvc
kubectl cp multi-agent/nats-pod:/data ./nats-backup

# Restore
kubectl cp ./nats-backup multi-agent/nats-pod:/data
```

---

**Last Updated**: 2024
**Version**: 1.0.0
