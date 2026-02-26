# Model Service - Security Documentation

## Overview

This document outlines the security measures implemented in the Model Service for protecting sensitive API keys and ensuring secure operations.

## Encryption

### AES-256-GCM Encryption

All API keys are encrypted using AES-256-GCM (Galois/Counter Mode) encryption, which provides:

- **Confidentiality**: Data is encrypted and unreadable without the key
- **Authentication**: Ensures data hasn't been tampered with
- **Integrity**: Verifies data hasn't been corrupted

### Encryption Process

1. **Key Derivation**: Uses scrypt with a random 32-byte salt to derive encryption key from the secret
2. **Initialization Vector**: Generates a random 16-byte IV for each encryption
3. **Encryption**: Encrypts the plaintext using AES-256-GCM
4. **Authentication Tag**: Generates a 16-byte authentication tag
5. **Storage**: Concatenates salt + IV + auth tag + ciphertext and encodes as base64

### Implementation Details

```typescript
// Encryption format: base64(salt + iv + authTag + ciphertext)
const salt = randomBytes(32);        // 32 bytes
const iv = randomBytes(16);          // 16 bytes
const authTag = cipher.getAuthTag(); // 16 bytes
const ciphertext = ...;              // variable length
```

### Secret Management

**Required Configuration**:
```bash
ENCRYPTION_SECRET=minimum-32-character-secret-for-aes-256
```

**Best Practices**:
- Use a cryptographically secure random string
- Minimum 32 characters (256 bits)
- Never commit to version control
- Rotate regularly (requires re-encryption of all keys)
- Store in secure secret management system (e.g., AWS Secrets Manager, HashiCorp Vault)

## API Key Validation

### Provider Validation

Before storing any API key, the service validates it against the provider's API to ensure it's valid and has the necessary permissions.

#### OpenAI Validation

```typescript
GET https://api.openai.com/v1/models
Authorization: Bearer {apiKey}
```

- Success: API key is valid
- Failure: API key is rejected

#### Anthropic Validation

```typescript
POST https://api.anthropic.com/v1/messages
x-api-key: {apiKey}
anthropic-version: 2023-06-01

{
  "model": "claude-3-haiku-20240307",
  "max_tokens": 1,
  "messages": [{"role": "user", "content": "test"}]
}
```

- Success or 400 error: API key is valid
- Other errors: API key is rejected

#### Google Validation

```typescript
GET https://generativelanguage.googleapis.com/v1/models?key={apiKey}
```

- Success: API key is valid
- Failure: API key is rejected

#### Azure Validation

- Format validation only (requires endpoint configuration)
- Minimum length check

#### Ollama

- No validation (local deployment, no authentication required)

### Validation Benefits

1. ✅ Prevents storing invalid keys
2. ✅ Catches typos and formatting errors
3. ✅ Verifies permissions before storage
4. ✅ Provides immediate feedback to users

## Access Control

### Public Endpoints

- `POST /api/api-keys` - Create new API key (validates before storage)
- `GET /api/api-keys` - List user's API keys (no decryption)
- `GET /api/api-keys/:id` - Get API key metadata (no decryption)
- `PUT /api/api-keys/:id` - Update API key metadata
- `DELETE /api/api-keys/:id` - Delete API key

These endpoints never return decrypted API keys.

### Internal-Only Endpoint

```typescript
GET /api/api-keys/:id/decrypt
Headers:
  x-internal-secret: {INTERNAL_SECRET}
```

**Purpose**: Allow internal services to retrieve decrypted API keys

**Security Measures**:
1. Requires `INTERNAL_SECRET` header
2. Should only be accessible from internal network
3. Updates usage tracking (`lastUsedAt`, `usageCount`)
4. Should be protected by firewall rules

**Configuration**:
```bash
INTERNAL_SECRET=your-unique-internal-service-secret
```

## Data Protection

### At Rest

- ✅ API keys encrypted with AES-256-GCM
- ✅ Encryption keys stored in environment variables
- ✅ Database connection encrypted (SSL/TLS recommended)
- ✅ Backups should be encrypted

### In Transit

- ✅ HTTPS/TLS for all API communications
- ✅ Encrypted database connections
- ✅ No API keys in URLs (use request body or headers)

### In Memory

- ⚠️ Decrypted keys temporarily in memory during use
- ✅ Keys not logged
- ✅ No caching of decrypted keys

## API Key Lifecycle

### Creation

1. User submits API key
2. Validate key against provider API
3. If valid, encrypt key with AES-256-GCM
4. Extract key prefix for identification
5. Store encrypted key in database
6. Return metadata (no plaintext key)

### Usage

1. Internal service requests decrypted key
2. Verify internal secret header
3. Retrieve encrypted key from database
4. Decrypt key using encryption service
5. Update usage statistics
6. Return plaintext key (internal only)

### Deactivation

1. Set `isActive: false` on API key
2. Key remains in database but cannot be used
3. Can be reactivated if needed

### Deletion

1. Permanently remove API key from database
2. Cannot be recovered
3. Users must add new key if needed

## Audit Trail

### Current Implementation

- `createdAt` - When key was added
- `updatedAt` - Last metadata update
- `lastUsedAt` - Last time key was decrypted
- `usageCount` - Number of times key was decrypted

### Future Enhancements

- Detailed audit log table
- Who accessed the key
- What operation was performed
- IP address and user agent
- Success/failure status
- Retention policy

## Rate Limiting

### Per-Model Limits

Configure rate limits to prevent abuse:

```json
{
  "rateLimitPerMinute": 500,
  "rateLimitPerHour": 10000,
  "rateLimitPerDay": 50000
}
```

### Future Enhancements

- Rate limiting at API level
- Per-user quotas
- Automatic throttling
- Alert on suspicious activity

## Threat Model

### Threats Addressed

✅ **Database Breach**: Keys are encrypted, useless without encryption secret
✅ **Invalid Keys**: Validation prevents storing broken keys
✅ **Unauthorized Access**: Internal secret protects decryption endpoint
✅ **Key Leakage**: Keys never returned in API responses

### Remaining Risks

⚠️ **Encryption Secret Compromise**: Would allow decryption of all keys
⚠️ **Internal Secret Compromise**: Would allow unauthorized decryption
⚠️ **Memory Dumps**: Decrypted keys temporarily in memory
⚠️ **Side-Channel Attacks**: Timing attacks on validation

### Mitigations

1. **Secret Rotation**: Regularly rotate encryption and internal secrets
2. **Access Logging**: Monitor access to decryption endpoint
3. **Network Isolation**: Restrict decryption endpoint to internal network
4. **Memory Protection**: Use secure memory practices (future)
5. **Timing Safety**: Use constant-time comparisons (future)

## Compliance Considerations

### GDPR

- ✅ Data minimization (only store necessary data)
- ✅ Right to deletion (DELETE endpoint)
- ✅ Data portability (GET endpoints)
- ✅ Encryption at rest

### PCI DSS

- ✅ Encryption of cardholder data (if applicable)
- ✅ Access control
- ✅ Audit trails
- ⚠️ Key rotation policy needed

### SOC 2

- ✅ Access controls
- ✅ Encryption
- ⚠️ Logging and monitoring (future)
- ⚠️ Incident response plan (future)

## Security Checklist

### Deployment

- [ ] Strong `ENCRYPTION_SECRET` (32+ characters)
- [ ] Unique `INTERNAL_SECRET`
- [ ] Secrets stored in secret manager (not environment files)
- [ ] HTTPS/TLS enabled
- [ ] Database connection encrypted
- [ ] Firewall rules for internal endpoints
- [ ] Network segmentation
- [ ] Monitoring and alerting configured

### Operations

- [ ] Regular security audits
- [ ] Secret rotation schedule
- [ ] Access log monitoring
- [ ] Incident response plan
- [ ] Backup and recovery tested
- [ ] Dependency vulnerability scanning
- [ ] Code security scanning

### Development

- [ ] Security code reviews
- [ ] Dependency updates
- [ ] Security testing
- [ ] Input validation
- [ ] Error handling (no sensitive data in errors)
- [ ] Logging (no sensitive data in logs)

## Incident Response

### Key Compromise

1. Immediately rotate affected API keys at provider
2. Deactivate keys in model-service
3. Investigate access logs
4. Notify affected users
5. Update security measures

### Encryption Secret Compromise

1. Generate new encryption secret
2. Decrypt all keys with old secret
3. Re-encrypt with new secret
4. Update all service configurations
5. Audit all access during compromise period

### Database Breach

1. Assess what data was accessed
2. Keys are encrypted (verify encryption secret not compromised)
3. Rotate all API keys as precaution
4. Notify affected users
5. Enhance security measures

## Best Practices

### For Developers

1. ✅ Never log API keys in plaintext
2. ✅ Use parameterized queries (prevent SQL injection)
3. ✅ Validate all inputs
4. ✅ Use constant-time comparisons for secrets
5. ✅ Handle errors securely (no sensitive data)
6. ✅ Keep dependencies updated

### For Operators

1. ✅ Use strong, unique secrets
2. ✅ Rotate secrets regularly
3. ✅ Monitor access logs
4. ✅ Set up alerting
5. ✅ Test backup and recovery
6. ✅ Document incident response procedures

### For Users

1. ✅ Use separate keys per environment
2. ✅ Rotate keys regularly
3. ✅ Monitor key usage
4. ✅ Deactivate unused keys
5. ✅ Report suspicious activity
6. ✅ Use strong authentication

## References

- [NIST Encryption Guidelines](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)

## Contact

For security concerns or to report vulnerabilities, please contact the security team immediately.
