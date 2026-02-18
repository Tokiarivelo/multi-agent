# Deployment Guide - Agent Service

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker & Docker Compose (optional)
- pnpm package manager

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `MODEL_SERVICE_URL` - URL of the model service
- `TOOL_SERVICE_URL` - URL of the tool service
- `PORT` - Service port (default: 3002)

Optional environment variables:
- `OPENAI_API_KEY` - OpenAI API key (can be fetched from model-service)
- `ANTHROPIC_API_KEY` - Anthropic API key (can be fetched from model-service)
- `MAX_TOKENS_PER_REQUEST` - Maximum tokens per request (default: 4000)
- `REQUEST_TIMEOUT_MS` - Request timeout in milliseconds (default: 60000)

## Local Development

### 1. Install Dependencies

```bash
make install
# or
pnpm install
```

### 2. Setup Database

```bash
# Generate Prisma client
make db-generate

# Run migrations
make db-migrate

# Or use the all-in-one command
make dev-setup
```

### 3. Start Development Server

```bash
make start-dev
# or
pnpm run start:dev
```

The service will be available at:
- API: http://localhost:3002/api
- Health: http://localhost:3002/api/health
- WebSocket: ws://localhost:3002/agent-execution

## Docker Deployment

### Using Docker Compose

```bash
# Build and start services
make docker-up
# or
docker-compose up -d

# View logs
make docker-logs
# or
docker-compose logs -f

# Stop services
make docker-down
# or
docker-compose down
```

### Using Docker Only

```bash
# Build image
make docker-build
# or
docker build -t agent-service:latest .

# Run container
docker run -d \
  -p 3002:3002 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e MODEL_SERVICE_URL=http://model-service:3001 \
  -e TOOL_SERVICE_URL=http://tool-service:3003 \
  --name agent-service \
  agent-service:latest
```

## Production Deployment

### 1. Build for Production

```bash
pnpm run build
```

### 2. Run Database Migrations

```bash
pnpm prisma:migrate
```

### 3. Start Production Server

```bash
NODE_ENV=production pnpm run start:prod
```

### 4. Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start service
pm2 start dist/main.js --name agent-service

# Monitor
pm2 monit

# Logs
pm2 logs agent-service

# Restart
pm2 restart agent-service
```

## Kubernetes Deployment

### 1. Create ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-service-config
data:
  MODEL_SERVICE_URL: "http://model-service:3001"
  TOOL_SERVICE_URL: "http://tool-service:3003"
  PORT: "3002"
```

### 2. Create Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: agent-service-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@postgres:5432/agent_service"
  OPENAI_API_KEY: "your-key"
  ANTHROPIC_API_KEY: "your-key"
```

### 3. Create Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-service
  template:
    metadata:
      labels:
        app: agent-service
    spec:
      containers:
      - name: agent-service
        image: agent-service:latest
        ports:
        - containerPort: 3002
        envFrom:
        - configMapRef:
            name: agent-service-config
        - secretRef:
            name: agent-service-secrets
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3002
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 4. Create Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: agent-service
spec:
  selector:
    app: agent-service
  ports:
  - protocol: TCP
    port: 3002
    targetPort: 3002
  type: LoadBalancer
```

## Database Management

### Migrations

```bash
# Create new migration
pnpm prisma:migrate --name migration_name

# Apply migrations
pnpm prisma:migrate

# Reset database (development only)
npx prisma migrate reset
```

### Prisma Studio

```bash
# Open database GUI
pnpm prisma:studio
```

## Monitoring & Logging

### Health Check

```bash
curl http://localhost:3002/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "agent-service"
}
```

### Application Logs

Logs are written to stdout/stderr. In production, use a log aggregation service like:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- CloudWatch (AWS)
- Cloud Logging (GCP)

### Metrics

Consider integrating:
- Prometheus for metrics collection
- Grafana for visualization
- New Relic / Datadog for APM

## Scaling Considerations

1. **Horizontal Scaling**: The service is stateless and can be scaled horizontally
2. **Database Connection Pooling**: Configure Prisma connection pool
3. **Rate Limiting**: Implement rate limiting at API gateway level
4. **Caching**: Consider Redis for caching frequently accessed agents
5. **Load Balancing**: Use nginx or cloud load balancer

## Security Checklist

- [ ] Enable HTTPS/TLS in production
- [ ] Secure database with strong passwords
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Enable CORS only for trusted origins
- [ ] Implement rate limiting
- [ ] Add authentication/authorization
- [ ] Regular security updates
- [ ] API key rotation policy
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma handles this)

## Backup & Recovery

### Database Backup

```bash
# Backup
pg_dump -U postgres agent_service > backup.sql

# Restore
psql -U postgres agent_service < backup.sql
```

### Automated Backups

Set up automated backups using:
- Cloud provider managed backups (RDS, Cloud SQL)
- Cron jobs with pg_dump
- Backup tools like pgBackRest

## Troubleshooting

### Service Won't Start

1. Check environment variables
2. Verify database connection
3. Check port availability
4. Review logs

### Database Connection Issues

1. Verify DATABASE_URL format
2. Check network connectivity
3. Ensure database is running
4. Check firewall rules

### WebSocket Connection Issues

1. Verify CORS configuration
2. Check WebSocket support in load balancer
3. Ensure proper protocol (ws:// or wss://)
4. Check client library compatibility

### High Memory Usage

1. Check for memory leaks
2. Monitor database connection pool
3. Review LangChain provider memory usage
4. Implement streaming for large responses

## Performance Optimization

1. **Database Indexing**: Ensure proper indexes on frequently queried fields
2. **Connection Pooling**: Optimize Prisma connection pool size
3. **Caching**: Cache agent configurations
4. **Async Processing**: Use queues for long-running tasks
5. **CDN**: Use CDN for static assets

## Support

For issues and questions:
- Check logs: `docker-compose logs -f` or `pm2 logs`
- Review API documentation: `API.md`
- Check examples: `EXAMPLES.md`
- GitHub Issues: [repository]/issues
