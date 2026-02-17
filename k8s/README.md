# Kubernetes Manifests for Multi-Agent Platform

This directory contains production-ready Kubernetes manifests for deploying the Multi-Agent Platform.

## Directory Structure

```
k8s/
├── namespace.yaml              # Namespace definition
├── secrets.yaml                # Secrets (credentials, API keys)
├── configmaps.yaml             # Configuration for all services
├── ingress.yaml                # Ingress rules for routing
├── postgres/
│   └── postgres.yaml           # PostgreSQL StatefulSet
├── qdrant/
│   └── qdrant.yaml             # Qdrant vector database StatefulSet
├── nats/
│   └── nats.yaml               # NATS messaging system
├── services/
│   ├── gateway-service.yaml    # API Gateway
│   ├── orchestration-service.yaml
│   ├── agent-service.yaml
│   ├── tool-service.yaml
│   ├── model-service.yaml
│   ├── vector-service.yaml
│   └── execution-service.yaml
└── frontend/
    └── frontend.yaml           # Next.js frontend
```

## Prerequisites

1. **Kubernetes Cluster** (v1.24+)
   - Minikube, Kind, or cloud provider (GKE, EKS, AKS)
   
2. **kubectl** configured with cluster access

3. **Skaffold** (v2.0+) for development workflow

4. **Ingress Controller** (nginx-ingress recommended)
   ```bash
   # For latest version, see: https://kubernetes.github.io/ingress-nginx/deploy/
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
   ```

5. **Metrics Server** (for HPA)
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

## Quick Start

### Using Skaffold (Recommended)

```bash
# Development mode with hot reload
skaffold dev

# Run once and deploy
skaffold run

# Production deployment
skaffold run -p prod

# Debug mode
SKAFFOLD_DEBUG=true skaffold dev -p debug
```

### Manual Deployment

```bash
# 1. Create namespace
kubectl apply -f namespace.yaml

# 2. Create secrets (UPDATE VALUES FIRST!)
kubectl apply -f secrets.yaml

# 3. Create ConfigMaps
kubectl apply -f configmaps.yaml

# 4. Deploy infrastructure
kubectl apply -f postgres/postgres.yaml
kubectl apply -f qdrant/qdrant.yaml
kubectl apply -f nats/nats.yaml

# 5. Wait for infrastructure to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n multi-agent --timeout=300s
kubectl wait --for=condition=ready pod -l app=qdrant -n multi-agent --timeout=300s
kubectl wait --for=condition=ready pod -l app=nats -n multi-agent --timeout=300s

# 6. Deploy services
kubectl apply -f services/

# 7. Deploy frontend
kubectl apply -f frontend/frontend.yaml

# 8. Deploy ingress
kubectl apply -f ingress.yaml
```

## Configuration

### Secrets

**IMPORTANT**: Update `secrets.yaml` with your actual values before deploying!

```bash
# Generate JWT secret
echo -n "your-secure-jwt-secret-minimum-32-characters" | base64

# Encode database URL
echo -n "postgresql://user:pass@postgres:5432/multi_agent" | base64

# Encode API keys
echo -n "sk-your-openai-key" | base64
echo -n "sk-ant-your-anthropic-key" | base64
```

Replace the base64 values in `k8s/secrets.yaml`.

### ConfigMaps

Adjust environment variables in `k8s/configmaps.yaml`:
- Service URLs
- Database configuration
- NATS URL
- Log levels

### Ingress

Update `k8s/ingress.yaml`:
- Change `multi-agent.local` to your domain
- Uncomment TLS section for HTTPS
- Configure cert-manager annotations if using Let's Encrypt

## Resource Requirements

### Minimum Cluster Resources

- **CPU**: 8 cores
- **Memory**: 16 GB RAM
- **Storage**: 30 GB (for persistent volumes)

### Per-Service Resources

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|-------------|-----------|----------------|--------------|
| Gateway | 200m | 500m | 256Mi | 512Mi |
| Orchestration | 300m | 1000m | 512Mi | 1Gi |
| Agent | 300m | 2000m | 1Gi | 4Gi |
| Tool | 200m | 500m | 256Mi | 512Mi |
| Model | 500m | 2000m | 1Gi | 4Gi |
| Vector | 300m | 1000m | 512Mi | 2Gi |
| Execution | 200m | 1000m | 256Mi | 1Gi |
| Frontend | 200m | 500m | 256Mi | 512Mi |
| PostgreSQL | 250m | 1000m | 256Mi | 1Gi |
| Qdrant | 500m | 2000m | 512Mi | 2Gi |

## High Availability

### Horizontal Pod Autoscaling (HPA)

All services are configured with HPA:
- **Min Replicas**: 2
- **Max Replicas**: 10
- **Target CPU**: 70%
- **Target Memory**: 80%

Monitor HPA status:
```bash
kubectl get hpa -n multi-agent
```

### Persistent Storage

StatefulSets with persistent volumes:
- PostgreSQL: 10Gi
- Qdrant: 10Gi

## Monitoring & Health Checks

### Liveness Probes
- Checks if container is alive
- Restarts container on failure
- Configured for all services at `/health`

### Readiness Probes
- Checks if container can accept traffic
- Removes from service endpoints on failure
- Configured for all services at `/health`

### Check Pod Status
```bash
# All pods
kubectl get pods -n multi-agent

# Specific service
kubectl get pods -l app=gateway-service -n multi-agent

# Pod logs
kubectl logs -f <pod-name> -n multi-agent

# Describe pod
kubectl describe pod <pod-name> -n multi-agent
```

## Port Forwarding

Access services locally:

```bash
# Gateway API
kubectl port-forward -n multi-agent svc/gateway-service 3000:3000

# Frontend
kubectl port-forward -n multi-agent svc/frontend 3001:3001

# PostgreSQL
kubectl port-forward -n multi-agent svc/postgres 5432:5432

# Qdrant
kubectl port-forward -n multi-agent svc/qdrant 6333:6333

# NATS
kubectl port-forward -n multi-agent svc/nats 4222:4222
```

## Accessing the Application

### Via Ingress (Production)

Add to `/etc/hosts` for local testing:
```
127.0.0.1 multi-agent.local api.multi-agent.local
```

Access:
- Frontend: http://multi-agent.local
- API: http://api.multi-agent.local
- Or: http://multi-agent.local/api

### Via Port Forward (Development)

```bash
# Using Skaffold (automatic)
skaffold dev

# Manual
kubectl port-forward -n multi-agent svc/frontend 3001:3001 &
kubectl port-forward -n multi-agent svc/gateway-service 3000:3000 &
```

Access:
- Frontend: http://localhost:3001
- API: http://localhost:3000

## Scaling

### Manual Scaling
```bash
# Scale a deployment
kubectl scale deployment gateway-service -n multi-agent --replicas=5

# Scale all services
kubectl scale deployment -n multi-agent --all --replicas=3
```

### Auto-scaling
HPA automatically scales based on CPU/Memory usage.

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n multi-agent

# Check pod events
kubectl describe pod <pod-name> -n multi-agent

# Check logs
kubectl logs <pod-name> -n multi-agent
```

### Common Issues

1. **ImagePullBackOff**: Images not built or not accessible
   ```bash
   # Build images with Skaffold
   skaffold build
   ```

2. **CrashLoopBackOff**: Application crashing on start
   ```bash
   # Check logs
   kubectl logs <pod-name> -n multi-agent --previous
   ```

3. **Secrets not found**: Update secrets.yaml
   ```bash
   kubectl delete secret multi-agent-secrets -n multi-agent
   kubectl apply -f k8s/secrets.yaml
   ```

4. **Database connection issues**: Check if PostgreSQL is ready
   ```bash
   kubectl get pods -l app=postgres -n multi-agent
   kubectl logs <postgres-pod> -n multi-agent
   ```

### Debug Container

```bash
# Get shell in a pod
kubectl exec -it <pod-name> -n multi-agent -- /bin/sh

# Run debug pod
kubectl run debug -n multi-agent -it --rm --image=alpine -- sh
```

## Cleanup

```bash
# Delete all resources
kubectl delete namespace multi-agent

# Or using Skaffold
skaffold delete
```

## Production Checklist

- [ ] Update all secrets with production values
- [ ] Configure proper ingress domain
- [ ] Enable TLS/HTTPS with cert-manager
- [ ] Set up proper monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation (ELK/Loki)
- [ ] Set up backup strategy for databases
- [ ] Review and adjust resource limits
- [ ] Configure network policies (see network-policy.yaml)
- [ ] Set up CI/CD pipeline
- [ ] Configure image registry
- [ ] Enable pod security policies
- [ ] Set up alerting
- [ ] Document runbooks

## Network Policies (TODO)

Network policies are not enabled by default. To enable:
1. Ensure your cluster supports network policies
2. Create and apply network-policy.yaml
3. Test connectivity between services

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Skaffold Documentation](https://skaffold.dev/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager](https://cert-manager.io/docs/)

## Support

For issues and questions:
1. Check pod logs: `kubectl logs <pod-name> -n multi-agent`
2. Check events: `kubectl get events -n multi-agent`
3. Review this documentation
4. Open an issue in the repository
