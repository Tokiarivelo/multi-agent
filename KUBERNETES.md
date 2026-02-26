# Kubernetes Deployment Guide

## Quick Start

### Prerequisites
- Kubernetes cluster (v1.24+)
- kubectl configured
- Skaffold v2.0+ (optional but recommended)
- Docker for building images

### Deploy Everything

```bash
# Option 1: Using Skaffold (Recommended)
skaffold dev

# Option 2: Using Makefile
make setup    # Setup local cluster (minikube)
make deploy   # Deploy all services

# Option 3: Manual kubectl
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmaps.yaml
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/qdrant/
kubectl apply -f k8s/nats/
kubectl apply -f k8s/services/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml
```

## Configuration

### Update Secrets
Edit `k8s/secrets.yaml` with your actual credentials:

```bash
# Generate base64 encoded secrets
echo -n "your-jwt-secret-32-chars-minimum" | base64
echo -n "postgresql://postgres:password@postgres:5432/multi_agent" | base64
echo -n "sk-your-openai-api-key" | base64
```

### Service URLs
Update in `k8s/configmaps.yaml` if needed.

### Ingress Domain
Update in `k8s/ingress.yaml`:
- Change `multi-agent.local` to your domain
- Uncomment TLS section for HTTPS

## Accessing Services

### Local Development
```bash
# Port forwarding
make port-forward

# Or manually
kubectl port-forward -n multi-agent svc/frontend 3001:3001
kubectl port-forward -n multi-agent svc/gateway-service 3000:3000
```

Access:
- Frontend: http://localhost:3001
- API: http://localhost:3000

### Production (Ingress)
```bash
# Add to /etc/hosts
127.0.0.1 multi-agent.local api.multi-agent.local

# Start tunnel (minikube)
minikube tunnel
```

Access:
- Frontend: http://multi-agent.local
- API: http://api.multi-agent.local

## Monitoring

```bash
# Check status
make status

# View logs
make logs

# Check health
make check-health

# Resource usage
make top
```

## Scaling

```bash
# Manual scaling
make scale DEPLOY=gateway-service REPLICAS=5

# Auto-scaling is configured via HPA
kubectl get hpa -n multi-agent
```

## Common Commands

```bash
# Development
make dev                # Hot reload development
make build              # Build images
make deploy             # Deploy to cluster

# Operations
make status             # Show all resources
make logs               # View logs
make port-forward       # Forward ports
make restart DEPLOY=... # Restart deployment
make scale DEPLOY=... REPLICAS=...

# Maintenance
make backup-db          # Backup database
make update-secrets     # Update secrets
make clean              # Delete everything
```

## Troubleshooting

### Pods not starting
```bash
kubectl get pods -n multi-agent
kubectl describe pod <pod-name> -n multi-agent
kubectl logs <pod-name> -n multi-agent
```

### Database connection issues
```bash
kubectl logs -n multi-agent -l app=postgres
kubectl exec -it -n multi-agent <postgres-pod> -- psql -U postgres
```

### Ingress not working
```bash
kubectl get ingress -n multi-agent
kubectl describe ingress multi-agent-ingress -n multi-agent
```

## Production Checklist

- [ ] Update all secrets in `k8s/secrets.yaml`
- [ ] Configure ingress domain in `k8s/ingress.yaml`
- [ ] Enable TLS/HTTPS
- [ ] Review resource limits
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation
- [ ] Set up database backups
- [ ] Apply network policies (optional)
- [ ] Configure CI/CD pipeline
- [ ] Set up alerting

## Documentation

See `k8s/README.md` for detailed documentation.

## Architecture

```
┌─────────────┐
│   Ingress   │
└──────┬──────┘
       │
   ────┴────
   │       │
   ▼       ▼
┌─────┐ ┌─────────┐
│Front│ │ Gateway │
│end  │ │ Service │
└─────┘ └────┬────┘
             │
       ┌─────┴─────┐
       ▼           ▼
┌──────────┐  ┌────────┐
│Orchestr. │  │  NATS  │
└────┬─────┘  └────────┘
     │
  ┌──┴──┬──────┬──────┬────────┐
  ▼     ▼      ▼      ▼        ▼
┌────┐┌────┐┌─────┐┌──────┐┌────────┐
│Agent││Tool││Model││Vector││Execution│
└────┘└────┘└─────┘└──┬───┘└────────┘
                      │
                      ▼
              ┌────────────┐
              │   Qdrant   │
              └────────────┘
                      
       ┌──────────────┐
       │  PostgreSQL  │
       └──────────────┘
```

## Support

For issues:
1. Check logs: `make logs`
2. Check status: `make status`
3. Review documentation: `k8s/README.md`
4. Check pod events: `kubectl get events -n multi-agent`
