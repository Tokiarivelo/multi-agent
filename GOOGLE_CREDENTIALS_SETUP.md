# Google Application Credentials Setup

## Overview

This document explains how the `GOOGLE_APPLICATION_CREDENTIALS` environment variable is configured and used across the multi-agent platform for Gmail Pub/Sub notifications.

## Credential File Location

**File**: `gmail-pubsub-credentials.json`  
**Path**: `/home/tokiarivelo/Documents/Projects/multi-agent/gmail-pubsub-credentials.json`  
**Status**: ✓ File exists and is accessible  
**Security**: ✓ Protected by `.gitignore` pattern `*credentials.json`

## Services Using This Credential

### 1. Email MCP Service (`services/email-mcp-service`)

**Purpose**: Pull Gmail Push notifications from Google Cloud Pub/Sub

**Tools using credentials**:

- `gmail_pull_notifications` - Retrieves Gmail notifications from Pub/Sub subscription
- `gmail_watch` - Registers Gmail account for push notifications

**Configuration**:

```env
# services/email-mcp-service/.env
GOOGLE_APPLICATION_CREDENTIALS=/home/tokiarivelo/Documents/Projects/multi-agent/gmail-pubsub-credentials.json
```

**Usage**: The `GmailPubSubService` class uses Application Default Credentials (ADC):

- If `GOOGLE_APPLICATION_CREDENTIALS` is set, it automatically loads the credentials
- Fallback: Pass `credentialsPath` explicitly in tool calls

### 2. Orchestration Service (`services/orchestration-service`)

**Purpose**: Automatically poll Gmail Pub/Sub for notifications every 30 seconds

**Configuration**:

```env
# services/orchestration-service/.env
GOOGLE_APPLICATION_CREDENTIALS=/home/tokiarivelo/Documents/Projects/multi-agent/gmail-pubsub-credentials.json
GMAIL_POLLING_ENABLED=true
GMAIL_PUBSUB_PROJECT_ID=test-sso-project-262509
GMAIL_PUBSUB_SUBSCRIPTION=gmail-notifications-sub
EMAIL_MCP_URL=http://localhost:3012
```

**Workflow**:

1. Orchestration service polls every 30s
2. Calls `gmail_pull_notifications` via email-mcp-service
3. For each notification, triggers workflows registered for that Gmail account

## Environment Configuration

### Root `.env` (Current Setup)

```env
# Gmail API (for Email MCP Service and Orchestration Service)
GMAIL_CLIENT_ID=YOUR_GMAIL_CLIENT_ID.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=YOUR_GMAIL_CLIENT_SECRET
GOOGLE_APPLICATION_CREDENTIALS=/home/tokiarivelo/Documents/Projects/multi-agent/gmail-pubsub-credentials.json
```

### Root `.env.example` (Template)

```env
# Gmail API (for Email MCP Service and Orchestration Service)
GMAIL_CLIENT_ID=your-gmail-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/gmail-pubsub-credentials.json
```

## Credential File Contents

The `gmail-pubsub-credentials.json` file contains:

```json
{
  "type": "service_account",
  "project_id": "test-sso-project-262509",
  "private_key_id": "[REDACTED]",
  "private_key": "[REDACTED]",
  "client_email": "gmail-pubsub-sa@test-sso-project-262509.iam.gserviceaccount.com",
  "client_id": "114744873159886403880",
  ...
}
```

**Permissions**: This service account has `roles/pubsub.admin` on project `test-sso-project-262509`

## Setup Instructions

### For New Developers

1. **Copy the credentials file** to the project root (if not already present):

   ```bash
   # The file should be at: /path/to/multi-agent/gmail-pubsub-credentials.json
   ```

2. **Set the environment variable** in your shell (optional, for testing):

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/multi-agent/gmail-pubsub-credentials.json"
   ```

3. **Or use the `.env` file** (recommended):

   ```bash
   # In .env at project root
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/multi-agent/gmail-pubsub-credentials.json
   ```

4. **Verify the path is correct**:
   ```bash
   test -f "$GOOGLE_APPLICATION_CREDENTIALS" && echo "✓ Credentials accessible" || echo "✗ File not found"
   ```

### For Docker/Kubernetes Deployment

1. **Mount the credentials file as a volume**:

   ```yaml
   volumes:
     - /host/path/to/gmail-pubsub-credentials.json:/app/credentials/gmail-pubsub-credentials.json:ro
   ```

2. **Set the environment variable to the mounted path**:

   ```yaml
   environment:
     - GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/gmail-pubsub-credentials.json
   ```

3. **Or use Kubernetes secrets**:

   ```bash
   kubectl create secret generic gmail-credentials \
     --from-file=credentials.json=./gmail-pubsub-credentials.json
   ```

   ```yaml
   env:
     - name: GOOGLE_APPLICATION_CREDENTIALS
       value: /var/secrets/google/credentials.json
   volumeMounts:
     - name: gmail-credentials
       mountPath: /var/secrets/google
       readOnly: true
   volumes:
     - name: gmail-credentials
       secret:
         secretName: gmail-credentials
   ```

## How Application Default Credentials Work

The Google Cloud client libraries use **Application Default Credentials (ADC)** in this order:

1. **`GOOGLE_APPLICATION_CREDENTIALS`** environment variable (if set) ← **We use this**
2. User credentials from `gcloud auth application-default login`
3. Compute Engine/GKE service account (when running on Google Cloud)

In our setup, we explicitly set `GOOGLE_APPLICATION_CREDENTIALS` to ensure consistent behavior across all environments.

## Code Implementation

### Email MCP Service - GmailPubSubService

```typescript
// services/email-mcp-service/src/infrastructure/email/gmail-pubsub.service.ts

private createPubSubClient(credentialsPath?: string): PubSub {
  if (credentialsPath) {
    // Explicit credentials path (overrides GOOGLE_APPLICATION_CREDENTIALS)
    return new PubSub({ keyFilename: credentialsPath });
  }
  // Use Application Default Credentials (reads GOOGLE_APPLICATION_CREDENTIALS automatically)
  return new PubSub();
}
```

### Usage in Tools

```typescript
// Pull notifications using ADC (from GOOGLE_APPLICATION_CREDENTIALS)
await gmailPubSub.pullNotifications({
  projectId: 'test-sso-project-262509',
  subscriptionName: 'gmail-notifications-sub',
  maxMessages: 10,
});

// Or pass credentials explicitly (bypasses GOOGLE_APPLICATION_CREDENTIALS)
await gmailPubSub.pullNotifications({
  projectId: 'test-sso-project-262509',
  subscriptionName: 'gmail-notifications-sub',
  maxMessages: 10,
  credentialsPath: '/custom/path/to/credentials.json',
});
```

## Security Best Practices

✅ **DO**:

- Keep the credentials file in the project root (already gitignored)
- Use absolute paths for `GOOGLE_APPLICATION_CREDENTIALS`
- Rotate service account keys regularly
- Use separate service accounts for dev/staging/prod
- Limit service account permissions to only what's needed (Pub/Sub subscriber/viewer)

❌ **DON'T**:

- Commit credentials to git (already protected by `.gitignore`)
- Share credentials via unencrypted channels
- Use relative paths for `GOOGLE_APPLICATION_CREDENTIALS`
- Grant excessive permissions to service accounts

## Troubleshooting

### Error: "No credentials found"

**Cause**: `GOOGLE_APPLICATION_CREDENTIALS` not set or file not found

**Solution**:

```bash
# Verify the environment variable is set
echo $GOOGLE_APPLICATION_CREDENTIALS

# Verify the file exists
ls -la $GOOGLE_APPLICATION_CREDENTIALS

# Set it in your .env file
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/gmail-pubsub-credentials.json
```

### Error: "Permission denied"

**Cause**: Service account lacks Pub/Sub permissions

**Solution**:

```bash
# Grant Pub/Sub Subscriber role
gcloud projects add-iam-policy-binding test-sso-project-262509 \
  --member="serviceAccount:gmail-pubsub-sa@test-sso-project-262509.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"
```

### Error: "Subscription not found"

**Cause**: Pub/Sub subscription doesn't exist

**Solution**:

```bash
# Create the subscription
gcloud pubsub subscriptions create gmail-notifications-sub \
  --topic=gmail-notifications \
  --ack-deadline=60
```

## Related Documentation

- [Email MCP Service README](services/email-mcp-service/README.md) - Complete Gmail Push notification setup
- [Google Cloud ADC Documentation](https://cloud.google.com/docs/authentication/application-default-credentials)
- [Google Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)

## Summary

- ✅ Credentials file exists at `/home/tokiarivelo/Documents/Projects/multi-agent/gmail-pubsub-credentials.json`
- ✅ Protected by `.gitignore` (won't be committed)
- ✅ Configured in root `.env` file with absolute path
- ✅ Used by `email-mcp-service` and `orchestration-service`
- ✅ Example configurations added to all relevant `.env.example` files
- ✅ Documentation updated with correct paths and setup instructions
