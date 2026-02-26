# Kubernetes Quick Reference Card

## Quick Commands

### Deploy
```bash
skaffold dev                    # Development mode with hot reload
make deploy                     # Deploy all services
kubectl apply -f k8s/           # Manual deployment
```

### Status
```bash
make status                     # All resources status
kubectl get all -n multi-agent  # All resources
kubectl get pods -n multi-agent # Just pods
```

### Logs
```bash
make logs                       # All service logs
make logs-gateway               # Gateway logs only
kubectl logs -f <pod> -n multi-agent
```

### Access Services
```bash
make port-forward               # Forward all ports
# Then access:
# - Frontend: http://localhost:3001
# - API: http://localhost:3000
# - Postgres: localhost:5432
# - Qdrant: http://localhost:6333
```

### Troubleshooting
```bash
kubectl describe pod <pod> -n multi-agent
kubectl logs <pod> -n multi-agent
kubectl get events -n multi-agent
make check-health
```

### Scale
```bash
make scale DEPLOY=gateway-service REPLICAS=5
kubectl get hpa -n multi-agent  # Check auto-scaling
```

### Cleanup
```bash
make clean                      # Delete all resources
skaffold delete                 # Using Skaffold
```

## Service Ports

| Service | Port | Endpoint |
|---------|------|----------|
| Gateway | 3000 | http://localhost:3000 |
| Frontend | 3001 | http://localhost:3001 |
| Orchestration | 3001 | Internal only |
| Agent | 3002 | Internal only |
| Tool | 3003 | Internal only |
| Model | 3004 | Internal only |
| Vector | 3005 | Internal only |
| Execution | 3006 | Internal only |
| PostgreSQL | 5432 | localhost:5432 |
| Qdrant | 6333 | http://localhost:6333 |
| NATS | 4222 | nats://localhost:4222 |

## Resource Limits

| Service | CPU | Memory |
|---------|-----|--------|
| Gateway | 200m-500m | 256Mi-512Mi |
| Agent | 300m-2000m | 1Gi-4Gi |
| Model | 500m-2000m | 1Gi-4Gi |
| Postgres | 250m-1000m | 256Mi-1Gi |
| Qdrant | 500m-2000m | 512Mi-2Gi |

## Configuration Files

- `k8s/secrets.yaml` - ⚠️ Update with real values!
- `k8s/configmaps.yaml` - Service URLs and config
- `k8s/ingress.yaml` - Domain and routing
- `skaffold.yaml` - Build and deploy config

## Common Issues

**Pods not starting:**
```bash
kubectl describe pod <pod> -n multi-agent
kubectl logs <pod> -n multi-agent
```

**Database connection failed:**
```bash
kubectl logs -n multi-agent -l app=postgres
kubectl port-forward -n multi-agent svc/postgres 5432:5432
```

**Image pull errors:**
```bash
skaffold build  # Rebuild images
```

## Production Checklist

- [ ] Update secrets.yaml with real values
- [ ] Update ingress.yaml domain
- [ ] Configure TLS/HTTPS
- [ ] Review resource limits
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Apply network policies (optional)

## Documentation

- `KUBERNETES.md` - Quick start guide
- `k8s/README.md` - Full documentation
- `K8S_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `Makefile` - Run `make help` for all commands

## Architecture

```
Ingress → Gateway → Orchestration → [Agent, Tool, Model, Vector, Execution]
            ↓              ↓                    ↓         ↓
         Frontend        NATS               Postgres  Qdrant
```

## Support

1. Check logs: `make logs`
2. Check status: `make status`
3. Check health: `make check-health`
4. Review events: `kubectl get events -n multi-agent`
