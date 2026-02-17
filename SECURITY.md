# Security Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [API Key Encryption](#api-key-encryption)
- [Data Protection](#data-protection)
- [Network Security](#network-security)
- [Rate Limiting](#rate-limiting)
- [CORS Configuration](#cors-configuration)
- [Input Validation](#input-validation)
- [Sandboxed Execution](#sandboxed-execution)
- [Security Best Practices](#security-best-practices)
- [Vulnerability Reporting](#vulnerability-reporting)
- [Compliance](#compliance)

## Overview

The Multi-Agent Platform implements multiple layers of security to protect user data, credentials, and system resources. This document outlines the security architecture and best practices.

### Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Minimal access rights
3. **Encryption at Rest**: Sensitive data encrypted
4. **Encryption in Transit**: HTTPS/TLS for all communications
5. **Zero Trust**: Verify every request
6. **Audit Logging**: Track all security events

## Authentication

### JWT (JSON Web Tokens)

The platform uses JWT for stateless authentication.

#### Token Structure

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  # Header
eyJzdWIiOiJ1c2VyLWlkIiwiaWF0IjoxNTE2...  # Payload
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV...     # Signature
```

#### Token Payload

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "USER",
  "iat": 1516239022,
  "exp": 1516325422
}
```

#### Implementation

```typescript
// services/gateway-service/src/auth/auth.service.ts
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  private async validateUser(email: string, password: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }
}
```

#### JWT Configuration

```typescript
// Environment variables
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1d

// Module configuration
JwtModule.register({
  secret: process.env.JWT_SECRET,
  signOptions: { expiresIn: process.env.JWT_EXPIRES_IN },
})
```

### Password Security

#### Password Hashing

Using bcrypt with salt rounds:

```typescript
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Hash password
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// Verify password
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

#### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (recommended)

#### Implementation

```typescript
import { IsString, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;
}
```

### Protected Routes

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentController {
  @Get()
  findAll() {
    // Only accessible with valid JWT
  }
}
```

## Authorization

### Role-Based Access Control (RBAC)

Three roles with hierarchical permissions:

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full system access, user management |
| **USER** | Create and manage own resources |
| **VIEWER** | Read-only access to own resources |

### Role Implementation

```typescript
// Database enum
enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER',
}

// Role guard
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(
      'roles',
      context.getHandler(),
    );
    
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}

// Usage
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    // Only admins can list all users
  }

  @Get('me')
  getCurrentUser(@Req() req) {
    // All authenticated users can access
    return req.user;
  }
}
```

### Resource Ownership

Ensure users can only access their own resources:

```typescript
@Injectable()
export class AgentService {
  async getAgent(agentId: string, userId: string) {
    const agent = await this.agentRepository.findById(agentId);
    
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Check ownership
    if (agent.userId !== userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    return agent;
  }
}
```

## API Key Encryption

### AES-256-GCM Encryption

Secure encryption for LLM provider API keys.

#### Encryption Process

```
Plain API Key
     │
     ▼
Generate Salt (32 bytes)
     │
     ▼
Derive Key (scrypt)
     │
     ▼
Generate IV (16 bytes)
     │
     ▼
Encrypt (AES-256-GCM)
     │
     ├─► Ciphertext
     ├─► Auth Tag (16 bytes)
     │
     ▼
Store: {encrypted, salt, iv, authTag}
```

#### Implementation

```typescript
// packages/common/src/encryption/encryption.service.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 32;
  private readonly tagLength = 16;

  encrypt(plaintext: string, masterKey: string): EncryptedData {
    // Generate salt
    const salt = randomBytes(this.saltLength);

    // Derive key
    const key = scryptSync(masterKey, salt, this.keyLength);

    // Generate IV
    const iv = randomBytes(this.ivLength);

    // Create cipher
    const cipher = createCipheriv(this.algorithm, key, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: Buffer.from(encrypted, 'hex'),
      salt,
      iv,
      authTag,
    };
  }

  decrypt(data: EncryptedData, masterKey: string): string {
    // Derive key
    const key = scryptSync(masterKey, data.salt, this.keyLength);

    // Create decipher
    const decipher = createDecipheriv(this.algorithm, key, data.iv);
    decipher.setAuthTag(data.authTag);

    // Decrypt
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

interface EncryptedData {
  encrypted: Buffer;
  salt: Buffer;
  iv: Buffer;
  authTag: Buffer;
}
```

#### Storage

```typescript
// services/model-service/src/application/use-cases/add-api-key.use-case.ts
@Injectable()
export class AddApiKeyUseCase {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly apiKeyRepository: ApiKeyRepository,
  ) {}

  async execute(userId: string, provider: string, apiKey: string) {
    const masterKey = process.env.ENCRYPTION_KEY;
    
    // Encrypt API key
    const encrypted = this.encryptionService.encrypt(apiKey, masterKey);

    // Store encrypted data
    return this.apiKeyRepository.save({
      userId,
      provider,
      encryptedKey: encrypted.encrypted,
      salt: encrypted.salt,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    });
  }
}
```

### Key Rotation

Implement key rotation for enhanced security:

```typescript
async rotateApiKey(apiKeyId: string, newMasterKey: string) {
  const apiKey = await this.apiKeyRepository.findById(apiKeyId);
  
  // Decrypt with old key
  const plaintext = this.encryptionService.decrypt(apiKey, oldMasterKey);
  
  // Re-encrypt with new key
  const encrypted = this.encryptionService.encrypt(plaintext, newMasterKey);
  
  // Update
  await this.apiKeyRepository.update(apiKeyId, encrypted);
}
```

## Data Protection

### Sensitive Data

Never log or expose:
- API keys
- Passwords
- JWT tokens
- Encryption keys
- Personal identifiable information (PII)

### Database Security

```typescript
// Prisma schema - sensitive fields
model ApiKey {
  id           String @id @default(uuid())
  userId       String
  provider     String
  encryptedKey Bytes  // Never expose in API
  salt         Bytes
  iv           Bytes
  authTag      Bytes
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, provider])
}
```

### API Response Sanitization

```typescript
// Never return sensitive fields
@Exclude()
password: string;

@Exclude()
encryptedKey: Buffer;

// Transform entities before returning
@Injectable()
export class ApiKeySerializer {
  serialize(apiKey: ApiKey) {
    return {
      id: apiKey.id,
      provider: apiKey.provider,
      userId: apiKey.userId,
      createdAt: apiKey.createdAt,
      // encryptedKey, salt, iv, authTag are excluded
    };
  }
}
```

## Network Security

### HTTPS/TLS

All production traffic must use HTTPS:

```typescript
// Enable HTTPS in production
if (process.env.NODE_ENV === 'production') {
  const httpsOptions = {
    key: fs.readFileSync('./secrets/key.pem'),
    cert: fs.readFileSync('./secrets/cert.pem'),
  };
  await app.listen(3000, httpsOptions);
}
```

### Network Policies (Kubernetes)

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: multi-agent-network-policy
spec:
  podSelector:
    matchLabels:
      app: gateway-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: agent-service
    ports:
    - protocol: TCP
      port: 3002
```

## Rate Limiting

### Implementation

```typescript
// services/tool-service/src/main.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many requests, please try again later',
});

app.use(limiter);
```

### Per-User Rate Limiting

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';

@Injectable()
export class UserRateLimitMiddleware implements NestMiddleware {
  private readonly limits = new Map<string, number>();
  private readonly maxRequests = 100;
  private readonly windowMs = 60000; // 1 minute

  use(req: any, res: Response, next: NextFunction) {
    const userId = req.user?.id;
    if (!userId) return next();

    const key = `${userId}-${Date.now()}`;
    const count = this.limits.get(userId) || 0;

    if (count >= this.maxRequests) {
      return res.status(429).json({
        message: 'Rate limit exceeded',
        retryAfter: this.windowMs / 1000,
      });
    }

    this.limits.set(userId, count + 1);
    setTimeout(() => this.limits.delete(userId), this.windowMs);

    next();
  }
}
```

## CORS Configuration

### Production CORS

```typescript
// services/gateway-service/src/main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600,
});
```

### Environment-Specific CORS

```typescript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN.split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};

app.enableCors(corsOptions);
```

## Input Validation

### DTO Validation

```typescript
import { IsString, IsEmail, MinLength, MaxLength, IsEnum } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @IsEnum(UserRole)
  role: UserRole;
}
```

### SQL Injection Prevention

Using Prisma ORM prevents SQL injection:

```typescript
// Safe - parameterized query
const user = await prisma.user.findUnique({
  where: { email: userEmail },
});

// Avoid raw queries
// const users = await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
```

### XSS Prevention

```typescript
import { sanitize } from 'class-sanitizer';

export class CreateAgentDto {
  @IsString()
  @MaxLength(100)
  @sanitize()
  name: string;

  @IsString()
  @MaxLength(500)
  @sanitize()
  description: string;
}
```

## Sandboxed Execution

### Isolated VM

Tool execution runs in an isolated environment:

```typescript
// services/tool-service/src/infrastructure/executors/isolated-vm.executor.ts
import ivm from 'isolated-vm';

@Injectable()
export class IsolatedVMExecutor {
  private readonly memoryLimit = 128; // MB
  private readonly timeLimit = 5000; // ms

  async execute(code: string, parameters: any) {
    const isolate = new ivm.Isolate({ memoryLimit: this.memoryLimit });
    const context = await isolate.createContext();

    // Inject parameters
    const jail = context.global;
    await jail.set('parameters', new ivm.ExternalCopy(parameters).copyInto());

    // Execute code
    const script = await isolate.compileScript(code);
    const result = await script.run(context, { timeout: this.timeLimit });

    return result;
  }
}
```

### Security Restrictions

- No file system access
- No network access (except HTTP tool)
- Memory limits enforced
- Execution timeout
- No access to host environment

## Security Best Practices

### Development

1. **Never commit secrets** to version control
2. **Use environment variables** for configuration
3. **Enable git hooks** for pre-commit checks
4. **Run security audits** regularly
5. **Keep dependencies updated**

### Deployment

1. **Use secrets management** (Vault, AWS Secrets Manager)
2. **Enable HTTPS/TLS** everywhere
3. **Implement network policies** in Kubernetes
4. **Use private container registry**
5. **Enable pod security policies**
6. **Rotate credentials** regularly

### Monitoring

1. **Log security events** (failed logins, unauthorized access)
2. **Monitor rate limits** and anomalies
3. **Set up alerts** for suspicious activity
4. **Regular security audits** and penetration testing

### Example Security Audit Commands

```bash
# NPM audit
pnpm audit

# Check for outdated packages
pnpm outdated

# Snyk security scan
snyk test

# OWASP dependency check
dependency-check --project "Multi-Agent Platform" --scan .
```

## Vulnerability Reporting

### Reporting Process

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. **Email**: security@multi-agent.example.com
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **24 hours**: Initial response
- **7 days**: Assessment and plan
- **30 days**: Fix and disclosure (coordinated)

### Hall of Fame

We acknowledge security researchers who responsibly disclose vulnerabilities.

## Compliance

### GDPR Compliance

- **Data Encryption**: All sensitive data encrypted
- **Right to be Forgotten**: User deletion cascades
- **Data Portability**: Export user data endpoint
- **Consent Management**: Explicit user consent
- **Audit Logs**: Track data access

### SOC 2 Considerations

- **Access Control**: RBAC implementation
- **Encryption**: Data at rest and in transit
- **Monitoring**: Comprehensive logging
- **Incident Response**: Security event handling
- **Vendor Management**: Third-party security

---

**Last Updated**: 2024
**Version**: 1.0.0

**Security Contact**: security@multi-agent.example.com
