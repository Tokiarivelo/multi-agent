# IMAP Connection Timeout Troubleshooting

## Issue

`ETIMEDOUT` errors when calling `gmail_list_attachments` or other IMAP operations.

## Root Causes

1. **Network Issues**: Firewall/proxy blocking imap.gmail.com:993
2. **Slow Gmail Response**: Connection takes > 10s to establish
3. **Invalid Credentials**: Wrong IMAP_USER or IMAP_PASS causing hang
4. **Rate Limiting**: Too many concurrent connections to Gmail

## Applied Fixes

### 1. Increased Timeouts

```typescript
connectionTimeout: 30_000,  // 10s → 30s
greetingTimeout: 20_000,    // 10s → 20s
socketTimeout: 60_000,      // 30s → 60s
```

### 2. Retry Logic with Exponential Backoff

- 3 automatic retries for transient errors
- 1s, 2s exponential backoff delays
- Skip retry for authentication errors

### 3. Better Error Logging

- Connection attempt tracking
- Full error stack traces in logs
- Clear differentiation between network/auth errors

### 4. Credential Validation

- Early validation of IMAP_USER and IMAP_PASS
- Fail fast with clear error messages

## Diagnostics

### Test IMAP Connection

```bash
cd services/email-mcp-service
tsx scripts/test-imap-connection.ts
```

This will:

- ✅ Test TCP connection to imap.gmail.com:993
- ✅ Authenticate with your credentials
- ✅ List mailboxes
- ✅ Fetch a test email
- 🔍 Provide troubleshooting tips on failure

### Test from Command Line

```bash
# Test TCP connectivity
nc -zv imap.gmail.com 993

# Test DNS resolution
ping imap.gmail.com

# Test with OpenSSL
openssl s_client -connect imap.gmail.com:993 -crlf
```

### Check Logs

Look for these patterns in logs:

```
[INFO] Connecting to IMAP (attempt 1/3)...
[WARN] IMAP connection attempt 1/3 failed: ETIMEDOUT
[ERROR] RPC error method="tools/call": Failed to list attachments after 3 attempts
```

## Gmail-Specific Issues

### App Password Required

Gmail requires **App Passwords** when using IMAP:

1. Go to: https://myaccount.google.com/apppasswords
2. Generate an app password for "Mail"
3. Use this password in `IMAP_PASS` (not your regular Gmail password)

### 2FA Must Be Enabled

App Passwords require 2FA to be enabled on your Google account.

### IMAP Must Be Enabled

1. Gmail Settings → Forwarding and POP/IMAP
2. Enable IMAP access

### Rate Limits

Gmail IMAP has rate limits:

- Max 15 concurrent connections
- Max 2500 MB/day bandwidth
- Too many failed auth attempts → temporary block

## Environment Variables

```bash
# Required
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

# Optional (defaults shown)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
```

## Alternative: OAuth2 (Future)

For production, consider implementing OAuth2 instead of app passwords:

- No password storage
- Fine-grained permissions
- Revocable tokens
- Better security

## Still Having Issues?

1. **Check service is running**: `curl http://localhost:3012/api/mcp/health`
2. **Verify environment**: `echo $IMAP_USER && echo $IMAP_PASS`
3. **Network diagnostics**: Run test script above
4. **Check Gmail quota**: https://mail.google.com/mail/u/0/#settings/fwdandpop
5. **Logs**: Check NestJS logs for detailed error messages
