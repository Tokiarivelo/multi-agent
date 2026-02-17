# Security Guide for Tool Service

## Overview

The Tool Service executes user-defined and built-in tools. This guide covers security considerations, best practices, and threat mitigation strategies.

## Security Architecture

### Defense in Depth

The service implements multiple layers of security:

1. **Sandboxing Layer**: isolated-vm isolation
2. **Access Control Layer**: Domain whitelisting, file operation controls
3. **Resource Control Layer**: Timeouts, memory limits, rate limiting
4. **Validation Layer**: Input validation, parameter type checking
5. **Monitoring Layer**: Audit logging, error tracking

## Threat Model

### Identified Threats

#### 1. Code Injection
**Risk**: High
**Description**: Malicious code execution in custom tools
**Mitigation**:
- isolated-vm sandbox isolation
- No access to `require()` or `process`
- Disabled `eval()` in sandbox
- No WebAssembly support

#### 2. Resource Exhaustion
**Risk**: High
**Description**: Infinite loops or excessive memory consumption
**Mitigation**:
- Execution timeouts (default 30s)
- Memory limits per execution
- Rate limiting on execution endpoint
- Process monitoring

#### 3. Data Exfiltration
**Risk**: Medium
**Description**: Unauthorized access to sensitive data
**Mitigation**:
- Network access only through built-in tools
- Domain whitelisting for HTTP requests
- File system access control
- No direct database access from tools

#### 4. Privilege Escalation
**Risk**: Medium
**Description**: Breaking out of sandbox
**Mitigation**:
- Keep isolated-vm updated
- No access to Node.js internal APIs
- Isolated execution context
- Principle of least privilege

#### 5. Denial of Service
**Risk**: Medium
**Description**: Service disruption through excessive requests
**Mitigation**:
- Rate limiting (30 req/min global, 10 req/min execute)
- Request timeout enforcement
- Resource usage monitoring
- Circuit breakers

## Sandbox Security

### isolated-vm Sandbox

isolated-vm provides isolated execution environment:

```javascript
const vm = new VM({
  timeout: 30000,           // Execution timeout
  sandbox: {                // Available context
    parameters,             // Tool parameters only
    console,               // Limited console methods
  },
  eval: false,             // Disable eval
  wasm: false,             // Disable WebAssembly
});
```

### Sandbox Limitations

**Blocked Features**:
- `require()` - No module loading
- `process` - No process access
- `__dirname`, `__filename` - No file system info
- `global`, `globalThis` - No global scope access
- `eval()`, `Function()` - No dynamic code execution
- WASM - No WebAssembly compilation

**Allowed Features**:
- Basic JavaScript operations
- Async/await
- Promises
- Array/Object methods
- Math operations
- JSON operations
- Console logging (monitored)

### Sandbox Bypass Prevention

**Known isolated-vm Vulnerabilities**: Keep isolated-vm updated to latest version

```bash
# Check for security updates
pnpm audit

# Update isolated-vm
pnpm update isolated-vm
```

**Code Review Checklist**:
- [ ] No attempts to access `constructor.constructor`
- [ ] No prototype pollution attempts
- [ ] No attempts to access `__proto__`
- [ ] No suspicious string concatenation for code generation
- [ ] No attempts to use `with` statement
- [ ] No buffer manipulation attempts

## Network Security

### Domain Whitelisting

Control which domains can be accessed:

```env
# Production: Strict whitelist
ALLOWED_DOMAINS=api.example.com,cdn.example.com

# Development: Allow all (DANGEROUS in production)
ALLOWED_DOMAINS=*
```

**Implementation**:
```typescript
private isAllowedDomain(url: string): boolean {
  if (this.allowedDomains.includes('*')) {
    return true; // Development only!
  }
  
  const urlObj = new URL(url);
  return this.allowedDomains.some(
    domain => urlObj.hostname.endsWith(domain)
  );
}
```

### HTTP Request Security

Built-in HTTP tool restrictions:

1. **Timeout**: Maximum 10 seconds per request
2. **Domain Check**: Enforced before request
3. **Size Limits**: Consider adding response size limits
4. **Headers**: Sanitize user-provided headers
5. **Redirects**: Consider limiting redirect following

**Recommended Configuration**:
```typescript
this.httpService.request({
  url,
  method,
  headers,
  data: body,
  timeout: 10000,
  maxRedirects: 5,
  maxContentLength: 10 * 1024 * 1024, // 10MB
});
```

## File System Security

### File Operation Controls

Disable file operations in production if not needed:

```env
ENABLE_FILE_OPERATIONS=false
```

### Path Traversal Prevention

If file operations are enabled, implement path validation:

```typescript
private validatePath(filePath: string): void {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(this.allowedDirectory);
  
  if (!resolved.startsWith(allowed)) {
    throw new Error('Path traversal attempt detected');
  }
}
```

### Recommended Restrictions

For production with file operations enabled:

1. **Whitelist directories**: Only allow specific directories
2. **Validate paths**: Prevent path traversal (`../`)
3. **Check permissions**: Verify file permissions
4. **Limit file sizes**: Set maximum file size
5. **Monitor operations**: Log all file access
6. **Scan uploads**: Virus scan any uploaded files

## Input Validation

### Parameter Validation

All tool parameters are validated:

```typescript
validateParameters(params: Record<string, any>): ValidationResult {
  const errors: string[] = [];
  
  for (const param of this.parameters) {
    // Check required
    if (param.required && !(param.name in params)) {
      errors.push(`Missing required parameter: ${param.name}`);
    }
    
    // Check type
    if (param.name in params) {
      const actualType = this.getType(params[param.name]);
      if (param.type !== actualType) {
        errors.push(`Invalid type for ${param.name}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

### SQL Injection Prevention

Built-in tools don't execute raw SQL. If database tools are added:

1. **Use parameterized queries**: Always
2. **Use ORM**: Prisma or similar
3. **Validate inputs**: Before queries
4. **Limit permissions**: Database user with minimal privileges
5. **No dynamic SQL**: Avoid string concatenation

### XSS Prevention

For web scraping results:

1. **Sanitize HTML**: Before returning
2. **Escape special chars**: In text content
3. **Content Security Policy**: For any web interface
4. **Don't execute scripts**: From scraped content

## Rate Limiting

### Configuration

```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60000,      // Time window (ms)
    limit: 30,       // Requests per window
  },
])
```

### Per-Endpoint Limits

```typescript
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Post('execute')
async execute(@Body() dto: ExecuteToolDto) {
  // Limited to 10 requests per minute
}
```

### Custom Rate Limiting

For user-specific limits:

```typescript
@UseGuards(ThrottlerGuard)
@Throttle({ user: { limit: 100, ttl: 3600000 } })
```

## Resource Management

### Memory Limits

```env
MAX_TOOL_MEMORY_MB=128
```

Monitor memory usage:

```typescript
const memBefore = process.memoryUsage().heapUsed;
// Execute tool
const memAfter = process.memoryUsage().heapUsed;
const memUsed = (memAfter - memBefore) / 1024 / 1024;

if (memUsed > this.maxMemoryMB) {
  logger.warn(`High memory usage: ${memUsed}MB`);
}
```

### Timeout Enforcement

```typescript
const timeout = dto.timeout || this.defaultTimeout;

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new Error(`Timeout after ${timeout}ms`));
  }, timeout);
});

const result = await Promise.race([
  this.executeCode(code, params),
  timeoutPromise,
]);
```

## Audit Logging

### What to Log

1. **Tool Execution**:
   - Tool ID and name
   - User ID
   - Parameters (sanitized)
   - Execution time
   - Success/failure
   - Error messages

2. **Security Events**:
   - Sandbox escape attempts
   - Rate limit violations
   - Domain whitelist violations
   - File operation attempts (when disabled)
   - Invalid parameter types
   - Timeout occurrences

3. **Administrative Actions**:
   - Tool creation/update/deletion
   - Configuration changes
   - Built-in tool modifications

### Log Format

```typescript
logger.log({
  event: 'tool_execution',
  toolId: dto.toolId,
  toolName: tool.name,
  userId: dto.userId,
  parameters: this.sanitizeParams(dto.parameters),
  executionTime: endTime - startTime,
  success: true,
  timestamp: new Date().toISOString(),
});
```

### Sensitive Data

**Never log**:
- API keys
- Passwords
- Tokens
- Personal information
- Credit card numbers
- Full file contents

**Sanitize before logging**:
```typescript
private sanitizeParams(params: any): any {
  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret'];
  const sanitized = { ...params };
  
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
```

## Error Handling

### Secure Error Messages

**Bad** (leaks information):
```typescript
throw new Error(`Database connection failed: ${dbUrl}`);
```

**Good** (generic):
```typescript
throw new Error('Database connection failed');
logger.error('DB connection failed', { url: dbUrl });
```

### Error Response Format

```typescript
{
  statusCode: 500,
  message: 'Tool execution failed',
  timestamp: '2024-01-01T00:00:00.000Z',
  // NO: stack traces, internal paths, credentials
}
```

## Security Headers

Add security headers in production:

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

## Deployment Security

### Environment Variables

**Never commit**:
- `.env` files
- API keys
- Database URLs
- Secrets

**Use secret management**:
- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets
- Docker secrets

### Container Security

```dockerfile
# Use specific version
FROM node:20.11.0-alpine

# Don't run as root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Read-only filesystem
RUN chmod -R 555 /app
```

### Network Security

1. **Use HTTPS**: Always in production
2. **Firewall rules**: Limit access to port 3003
3. **Internal network**: Keep service internal if possible
4. **Load balancer**: Use for SSL termination
5. **DDoS protection**: CloudFlare, AWS Shield, etc.

## Monitoring & Alerting

### Security Metrics

Monitor and alert on:

1. **Execution failures** > 10% in 5 minutes
2. **Rate limit hits** > 100 in 1 minute
3. **Timeout occurrences** > 50 in 5 minutes
4. **Memory usage** > 80% for 5 minutes
5. **Error rate** > 5% in 5 minutes
6. **Unusual patterns**: Execution at odd hours

### Alerting Configuration

```yaml
alerts:
  - name: high_error_rate
    condition: error_rate > 0.05
    duration: 5m
    severity: warning
    
  - name: rate_limit_breach
    condition: rate_limit_hits > 100
    duration: 1m
    severity: critical
    
  - name: suspicious_activity
    condition: execution_failures > 50
    duration: 5m
    severity: warning
```

## Incident Response

### Security Incident Procedure

1. **Detect**: Automated monitoring alerts
2. **Isolate**: Disable affected tools/users
3. **Investigate**: Check logs, audit trail
4. **Contain**: Patch vulnerability, update rules
5. **Recover**: Restore service, verify integrity
6. **Learn**: Post-mortem, update procedures

### Response Actions

**Sandbox Escape Detected**:
1. Immediately disable tool execution
2. Kill all running executions
3. Review and patch sandbox
4. Audit all recent executions
5. Notify affected users

**Rate Limit Abuse**:
1. Identify attacker IP/user
2. Temporarily ban IP/user
3. Increase rate limits if legitimate
4. Review logs for other patterns

**Data Exfiltration**:
1. Disable network access
2. Review audit logs
3. Identify compromised data
4. Notify affected parties
5. Implement additional controls

## Compliance

### GDPR Considerations

1. **Data minimization**: Only collect necessary data
2. **Right to deletion**: Implement tool deletion
3. **Data portability**: Export tool definitions
4. **Consent**: For data processing
5. **Audit trail**: Log all data access

### SOC 2 Compliance

1. **Access controls**: Role-based access
2. **Audit logging**: Comprehensive logs
3. **Encryption**: At rest and in transit
4. **Monitoring**: 24/7 monitoring
5. **Incident response**: Documented procedures

## Security Checklist

### Pre-Deployment

- [ ] isolated-vm updated to latest version
- [ ] All dependencies scanned for vulnerabilities
- [ ] Domain whitelist configured
- [ ] File operations disabled (or restricted)
- [ ] Rate limiting configured
- [ ] Timeouts configured
- [ ] Memory limits set
- [ ] Sandbox enabled
- [ ] HTTPS configured
- [ ] Security headers added
- [ ] Error messages sanitized
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Alerts configured

### Post-Deployment

- [ ] Verify sandbox isolation
- [ ] Test rate limiting
- [ ] Test timeout enforcement
- [ ] Review initial logs
- [ ] Monitor resource usage
- [ ] Verify health checks
- [ ] Test incident response
- [ ] Review security metrics

## Regular Maintenance

### Weekly

- [ ] Review security logs
- [ ] Check for failed executions
- [ ] Monitor resource usage
- [ ] Review rate limit hits

### Monthly

- [ ] Update dependencies
- [ ] Review and rotate secrets
- [ ] Audit custom tools
- [ ] Review security metrics
- [ ] Test disaster recovery

### Quarterly

- [ ] Security audit
- [ ] Penetration testing
- [ ] Review access controls
- [ ] Update documentation
- [ ] Staff security training

## Contact

For security issues:
- **Email**: security@example.com
- **PGP Key**: [key-id]
- **Bug Bounty**: [program-url]

**Do not** open public issues for security vulnerabilities.
