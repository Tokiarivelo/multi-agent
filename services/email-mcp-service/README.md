# Email MCP Service / Service Email MCP

## English

This service exposes email operations as MCP tools over JSON-RPC, and also provides a REST API with a full **Swagger UI** for direct testing.

### Swagger UI (Testing)

Start the service, then open:

```
http://localhost:3012/api/docs
```

Every tool has a dedicated REST endpoint you can call directly from the browser — no JSON-RPC wrapper needed. Fill in the form fields and click **Execute**.

| Tag             | Endpoint                                    | Tool                        |
| --------------- | ------------------------------------------- | --------------------------- |
| Gmail — IMAP    | `POST /api/tools/gmail/fetch-emails`        | `gmail_fetch_emails`        |
| Gmail — IMAP    | `POST /api/tools/gmail/manipulate-emails`   | `gmail_manipulate_emails`   |
| Gmail — IMAP    | `POST /api/tools/gmail/list-attachments`    | `gmail_list_attachments`    |
| Gmail — IMAP    | `POST /api/tools/gmail/download-attachment` | `gmail_download_attachment` |
| Gmail — Pub/Sub | `POST /api/tools/gmail/pull-notifications`  | `gmail_pull_notifications`  |
| Email — SMTP    | `POST /api/tools/email/send`                | `email_send`                |
| Email — SMTP    | `POST /api/tools/email/send-template`       | `email_send_template`       |
| Email — SMTP    | `POST /api/tools/email/verify-smtp`         | `email_verify_smtp`         |
| MCP — JSON-RPC  | `POST /api/mcp`                             | raw JSON-RPC 2.0            |

**Quick example — fetch emails by subject:**

```json
POST /api/tools/gmail/fetch-emails
{
  "mailbox": "INBOX",
  "limit": "20",
  "query": "subject:Candidature - Poste de Senior Developer"
}
```

If `imapUser`/`imapPass` are omitted, the service falls back to the `IMAP_USER`/`IMAP_PASS` environment variables.

---

### Available Tools

| Tool                        | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| `email_send`                | Send an email via SMTP (plain text or HTML body)        |
| `email_send_template`       | Send an email using a `{{variable}}` template           |
| `email_verify_smtp`         | Verify that SMTP credentials can connect                |
| `gmail_fetch_emails`        | Fetch emails from a Gmail inbox via IMAP                |
| `gmail_manipulate_emails`   | Mark emails as read/unread, move, or delete by UID      |
| `gmail_list_attachments`    | List all attachments for an email UID                   |
| `gmail_download_attachment` | Download an attachment as base64 by UID + partId        |
| `gmail_watch`               | Start Gmail push notifications via Pub/Sub              |
| `gmail_stop_watch`          | Stop Gmail push notifications                           |
| `gmail_pull_notifications`  | Pull Gmail push notifications from Pub/Sub subscription |

---

### Configuration

Create a `.env` file in this directory based on `.env.example`.

#### SMTP Configuration (sending — Google/Gmail)

1. Go to your [Google Account Settings](https://myaccount.google.com/).
2. Navigate to **Security**.
3. Enable **2-Step Verification**.
4. Search for **App Passwords**.
5. Create a new App Password for "Mail" and your device.
6. Use the generated 16-character password as `SMTP_PASS`.

```env
# Server
EMAIL_MCP_PORT=3012
NODE_ENV=development

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

#### IMAP Configuration (fetching — `gmail_fetch_emails` and related tools)

Gmail IMAP uses the **same App Password** as SMTP. The `IMAP_USER` and `IMAP_PASS` variables default to `SMTP_USER` / `SMTP_PASS`, so no extra credentials are needed if they are already set.

**Prerequisites:**

1. IMAP must be enabled in Gmail: Gmail → Settings → See all settings → Forwarding and POP/IMAP → **Enable IMAP**.
2. Use an App Password (same one as SMTP, or create a separate one).

```env
# IMAP (optional — falls back to SMTP_USER / SMTP_PASS)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com   # optional
IMAP_PASS=your-app-password      # optional
```

#### Gmail Push Notifications (Watch + Pull Workflow)

To receive real-time notifications for new emails, you must use **both** `gmail_watch` and `gmail_pull_notifications`.

**How it works:**

1. **`gmail_watch`** — Registers your Gmail account with Google's Push API. Google will publish notifications to your Pub/Sub topic when new emails arrive.
2. **`gmail_pull_notifications`** — Retrieves the notifications from your Pub/Sub subscription. Each notification contains a `historyId` that you can use with the Gmail History API to fetch the actual message details.

**Setup:**

##### 1. Create a Google Cloud Project & Enable APIs

```bash
# Create a new project (or use existing)
gcloud projects create my-project-id --name="My Project"

# Set as active project
gcloud config set project my-project-id

# Enable required APIs
gcloud services enable pubsub.googleapis.com
gcloud services enable gmail.googleapis.com
```

##### 2. Create Service Account & Download Credentials

```bash
# Create service account
gcloud iam service-accounts create gmail-pubsub-sa \
  --display-name="Gmail Pub/Sub Service Account"

# Create and download credentials JSON
gcloud iam service-accounts keys create ~/gmail-pubsub-credentials.json \
  --iam-account=gmail-pubsub-sa@my-project-id.iam.gserviceaccount.com

cloudshell download ~/gmail-pubsub-credentials.json

# Grant Pub/Sub permissions to the service account
gcloud projects add-iam-policy-binding my-project-id \
  --member="serviceAccount:gmail-pubsub-sa@my-project-id.iam.gserviceaccount.com" \
  --role="roles/pubsub.admin"
```

**Important:** Store the credentials file securely. Never commit it to git. Add `*-credentials.json` to your `.gitignore`.

##### 3. Create Pub/Sub Topic & Subscription

```bash
# Create topic for Gmail notifications
gcloud pubsub topics create gmail-notifications

# Grant Gmail permission to publish to this topic
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --role="roles/pubsub.publisher" \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com"

# Create Pull subscription
gcloud pubsub subscriptions create gmail-notifications-sub \
  --topic=gmail-notifications \
  --ack-deadline=60
```

##### 4. Setup OAuth2 for Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click **Create Credentials** → **OAuth 2.0 Client ID**
4. Choose **Web application** or **Desktop app**
5. Add authorized redirect URIs (e.g., `http://localhost:3000/auth/callback`)
6. Copy the **Client ID** and **Client Secret**

To get a refresh token, use the OAuth2 playground or implement an OAuth flow in your app.

##### 5. Configure Environment Variables

Add to your `.env` file:

```env
# Gmail OAuth2 (for gmail_watch tool)
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret

# Google Cloud Pub/Sub (for gmail_pull_notifications)
GOOGLE_CLOUD_PROJECT_ID=my-project-id
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/multi-agent/gmail-pubsub-credentials.json

# Optional: If not using GOOGLE_APPLICATION_CREDENTIALS
# PUBSUB_CREDENTIALS_PATH=/absolute/path/to/multi-agent/gmail-pubsub-credentials.json
```

**Note:** `GOOGLE_APPLICATION_CREDENTIALS` is the standard Google Cloud environment variable for Application Default Credentials (ADC). If set, the Pub/Sub client will automatically use it. You can also pass `credentialsPath` explicitly in tool calls.

##### 6. Configure Orchestration Service

Add to `services/orchestration-service/.env`:

```env
# Gmail Polling Configuration
GMAIL_POLLING_ENABLED=true
GMAIL_PUBSUB_PROJECT_ID=my-project-id
GMAIL_PUBSUB_SUBSCRIPTION=gmail-notifications-sub

# Email MCP Service URL
EMAIL_MCP_URL=http://localhost:3012

# Google Cloud Credentials (same as email-mcp-service)
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/multi-agent/gmail-pubsub-credentials.json
```

---

**Example workflow:**

```bash
# 1. Start watching (register for notifications)
POST /api/tools/gmail/watch
{
  "refreshToken": "your-oauth2-refresh-token",
  "topicName": "projects/my-project-id/topics/gmail-notifications"
}

# Response:
{
  "content": [{
    "type": "text",
    "text": "{\"success\":true,\"historyId\":\"1234567\",\"expiration\":\"1234567890000\"}"
  }]
}

# 2. Pull notifications (automated via orchestration-service every 30s)
POST /api/tools/gmail/pull-notifications
{
  "projectId": "my-project-id",
  "subscriptionName": "gmail-notifications-sub",
  "maxMessages": "10"
}

# Response:
{
  "content": [{
    "type": "text",
    "text": "{\"count\":2,\"notifications\":[{\"emailAddress\":\"user@gmail.com\",\"historyId\":\"1234567\"}]}"
  }]
}

# Optional: Pass credentials explicitly (if not using GOOGLE_APPLICATION_CREDENTIALS)
POST /api/tools/gmail/pull-notifications
{
  "projectId": "my-project-id",
  "subscriptionName": "gmail-notifications-sub",
  "maxMessages": "10",
  "credentialsPath": "/absolute/path/to/multi-agent/gmail-pubsub-credentials.json"
}
```

**Important:**

- The watch expires after **7 days**. You must call `gmail_watch` again to renew it.
- The orchestration service automatically polls for notifications **every 30 seconds**.
- Credentials file path must be **absolute**, not relative (e.g., `/home/user/project/gmail-pubsub-credentials.json`).
- If using Docker, mount the credentials file and set the path to the mounted location.
- The file `gmail-pubsub-credentials.json` is already in `.gitignore` to prevent accidental commits.

**Important:** The watch expires after 7 days. You must call `gmail_watch` again to renew it

---

### Troubleshooting Gmail Pub/Sub

**Problem: `gmail_pull_notifications` always returns `{"processed": 0, "notifications": []}`**

**Solution checklist:**

1. **Verify subscription exists:**

   ```bash
   gcloud pubsub subscriptions describe gmail-notifications-sub
   ```

   If not found, create it:

   ```bash
   gcloud pubsub subscriptions create gmail-notifications-sub \
     --topic=gmail-notifications \
     --ack-deadline=60
   ```

2. **Check Gmail watch is active:**

   ```bash
   POST /api/tools/gmail/watch
   {
     "refreshToken": "your-oauth2-refresh-token",
     "topicName": "projects/my-project-id/topics/gmail-notifications"
   }
   ```

   If you see `"success": false`, your watch may have expired (7-day limit).

3. **Verify credentials are correct:**
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account JSON file
   - Test credentials: `gcloud auth application-default print-access-token`

4. **Check Pub/Sub IAM permissions:**

   ```bash
   # Verify service account has Pub/Sub Admin role
   gcloud projects get-iam-policy my-project-id \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:gmail-pubsub-sa@my-project-id.iam.gserviceaccount.com"

   # Verify Gmail can publish to topic
   gcloud pubsub topics get-iam-policy gmail-notifications
   ```

   Should show `gmail-api-push@system.gserviceaccount.com` with role `roles/pubsub.publisher`.

5. **Test manually publishing a message:**

   ```bash
   gcloud pubsub topics publish gmail-notifications \
     --message='{"emailAddress":"test@gmail.com","historyId":"12345"}'

   # Then pull:
   POST /api/tools/gmail/pull-notifications
   {
     "projectId": "my-project-id",
     "subscriptionName": "gmail-notifications-sub",
     "maxMessages": "10"
   }
   ```

   If this works, the issue is with Gmail push notifications, not the pull logic.

6. **Check service logs:**

   ```bash
   # Email MCP service logs
   docker logs email-mcp-service

   # Or if running locally:
   pnpm --filter @multi-agent/email-mcp-service dev
   ```

   Look for: `Pulling up to X messages from gmail-notifications-sub`

7. **Verify subscription type:**
   The subscription **must** be type **Pull**, not **Push**. Check:

   ```bash
   gcloud pubsub subscriptions describe gmail-notifications-sub --format="value(pushConfig)"
   ```

   Should be empty. If you see a URL, delete and recreate as Pull:

   ```bash
   gcloud pubsub subscriptions delete gmail-notifications-sub
   gcloud pubsub subscriptions create gmail-notifications-sub --topic=gmail-notifications
   ```

---

### Using the Tools via JSON-RPC

The MCP endpoint at `POST /api/mcp` accepts JSON-RPC 2.0 requests. Prefer the Swagger UI for manual testing; use this endpoint for AI agent integration.

**Fetch emails:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "gmail_fetch_emails",
    "arguments": {
      "mailbox": "INBOX",
      "limit": "20",
      "query": "subject:Candidature - Poste de Senior Developer"
    }
  }
}
```

**All `gmail_fetch_emails` arguments are optional:**

| Argument   | Type   | Default          | Description                                                                                                     |
| ---------- | ------ | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `mailbox`  | string | `INBOX`          | Mailbox to read. Gmail system folders: `[Gmail]/Sent Mail`, `[Gmail]/Spam`, `[Gmail]/Trash`, `[Gmail]/All Mail` |
| `limit`    | string | `20`             | Number of most-recent emails to return (max 100)                                                                |
| `query`    | string | —                | Search filter using `key:value` pairs (see below)                                                               |
| `imapUser` | string | `IMAP_USER` env  | Override Gmail address per-request                                                                              |
| `imapPass` | string | `IMAP_PASS` env  | Override App Password per-request                                                                               |
| `imapHost` | string | `imap.gmail.com` | Override IMAP host                                                                                              |
| `imapPort` | string | `993`            | Override IMAP port                                                                                              |

**Query syntax** — space-separated `key:value` pairs:

| Key       | Example                  | Description               |
| --------- | ------------------------ | ------------------------- |
| `from`    | `from:alice@example.com` | Filter by sender          |
| `to`      | `to:bob@example.com`     | Filter by recipient       |
| `subject` | `subject:invoice`        | Filter by subject keyword |
| `text`    | `text:hello`             | Full-body text search     |
| `since`   | `since:2024-01-01`       | Emails after this date    |
| `before`  | `before:2024-06-01`      | Emails before this date   |

**Response shape:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"count\":1,\"emails\":[{\"uid\":4201,\"subject\":\"Invoice #42\",\"from\":\"Alice <alice@example.com>\",\"to\":\"you@gmail.com\",\"date\":\"2024-03-15T10:22:00.000Z\",\"snippet\":\"Hi, please find attached...\"}]}"
      }
    ]
  }
}
```

**List all registered tools:**

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "tools/list",
  "params": {}
}
```

---

## Français

Ce service expose des opérations d'email en tant qu'outils MCP via JSON-RPC, et fournit également une API REST avec une **interface Swagger** complète pour les tests.

### Interface Swagger (Tests)

Démarrez le service, puis ouvrez :

```
http://localhost:3012/api/docs
```

Chaque outil dispose d'un endpoint REST dédié utilisable directement depuis le navigateur — sans enveloppe JSON-RPC. Remplissez les champs et cliquez sur **Execute**.

| Tag             | Endpoint                                    | Outil                       |
| --------------- | ------------------------------------------- | --------------------------- |
| Gmail — IMAP    | `POST /api/tools/gmail/fetch-emails`        | `gmail_fetch_emails`        |
| Gmail — IMAP    | `POST /api/tools/gmail/manipulate-emails`   | `gmail_manipulate_emails`   |
| Gmail — IMAP    | `POST /api/tools/gmail/list-attachments`    | `gmail_list_attachments`    |
| Gmail — IMAP    | `POST /api/tools/gmail/download-attachment` | `gmail_download_attachment` |
| Gmail — Pub/Sub | `POST /api/tools/gmail/pull-notifications`  | `gmail_pull_notifications`  |
| Email — SMTP    | `POST /api/tools/email/send`                | `email_send`                |
| Email — SMTP    | `POST /api/tools/email/send-template`       | `email_send_template`       |
| Email — SMTP    | `POST /api/tools/email/verify-smtp`         | `email_verify_smtp`         |
| MCP — JSON-RPC  | `POST /api/mcp`                             | JSON-RPC 2.0 brut           |

**Exemple rapide — récupérer des emails par sujet :**

```json
POST /api/tools/gmail/fetch-emails
{
  "mailbox": "INBOX",
  "limit": "20",
  "query": "subject:Candidature - Poste de Senior Developer"
}
```

Si `imapUser`/`imapPass` sont omis, le service utilise les variables d'environnement `IMAP_USER`/`IMAP_PASS`.

---

### Outils disponibles

| Outil                       | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `email_send`                | Envoyer un email via SMTP (texte brut ou HTML)                     |
| `email_send_template`       | Envoyer un email avec un modèle `{{variable}}`                     |
| `email_verify_smtp`         | Vérifier que les identifiants SMTP fonctionnent                    |
| `gmail_fetch_emails`        | Récupérer des emails depuis une boîte Gmail via IMAP               |
| `gmail_manipulate_emails`   | Marquer comme lu/non-lu, déplacer ou supprimer par UID             |
| `gmail_list_attachments`    | Lister les pièces jointes d'un email par UID                       |
| `gmail_download_attachment` | Télécharger une pièce jointe en base64 par UID + partId            |
| `gmail_watch`               | Démarrer les notifications push Gmail via Pub/Sub                  |
| `gmail_stop_watch`          | Arrêter les notifications push Gmail                               |
| `gmail_pull_notifications`  | Récupérer les notifications push Gmail depuis l'abonnement Pub/Sub |

---

### Configuration

Créez un fichier `.env` dans ce répertoire en vous basant sur `.env.example`.

#### Configuration SMTP (envoi — Google/Gmail)

1. Allez dans les [Paramètres de votre compte Google](https://myaccount.google.com/).
2. Naviguez vers **Sécurité**.
3. Activez la **Validation en deux étapes**.
4. Recherchez **Mots de passe d'application**.
5. Créez un mot de passe d'application pour "Mail" et votre appareil.
6. Utilisez le mot de passe de 16 caractères généré dans `SMTP_PASS`.

```env
# Serveur
EMAIL_MCP_PORT=3012
NODE_ENV=development

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-application
SMTP_FROM=votre-email@gmail.com
```

#### Configuration IMAP (récupération — outils Gmail)

Gmail IMAP utilise le **même mot de passe d'application** que SMTP. `IMAP_USER` et `IMAP_PASS` héritent de `SMTP_USER` / `SMTP_PASS` si non définis.

**Prérequis :**

1. Activer IMAP dans Gmail : Gmail → Paramètres → Voir tous les paramètres → Transfert et POP/IMAP → **Activer IMAP**.
2. Utiliser un mot de passe d'application (le même que pour SMTP ou un nouveau).

```env
# IMAP (optionnel — utilise SMTP_USER / SMTP_PASS par défaut)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=votre-email@gmail.com   # optionnel
IMAP_PASS=votre-mot-de-passe      # optionnel
```

#### Notifications Push Gmail (Workflow Watch + Pull)

Pour recevoir des notifications en temps réel lors de l'arrivée de nouveaux emails, vous devez utiliser **à la fois** `gmail_watch` et `gmail_pull_notifications`.

**Comment ça fonctionne :**

1. **`gmail_watch`** — Enregistre votre compte Gmail auprès de l'API Push de Google. Google publiera des notifications sur votre topic Pub/Sub à l'arrivée de nouveaux emails.
2. **`gmail_pull_notifications`** — Récupère les notifications depuis votre abonnement Pub/Sub. Chaque notification contient un `historyId` que vous pouvez utiliser avec l'API Gmail History pour récupérer les détails du message.

**Configuration :**

##### 1. Créer un projet Google Cloud & activer les APIs

```bash
# Créer un nouveau projet (ou utiliser un existant)
gcloud projects create mon-projet-id --name="Mon Projet"

# Définir comme projet actif
gcloud config set project mon-projet-id

# Activer les APIs requises
gcloud services enable pubsub.googleapis.com
gcloud services enable gmail.googleapis.com
```

##### 2. Créer un compte de service & télécharger les identifiants

```bash
# Créer le compte de service
gcloud iam service-accounts create gmail-pubsub-sa \
  --display-name="Compte de service Gmail Pub/Sub"

# Créer et télécharger le fichier JSON des identifiants
gcloud iam service-accounts keys create ~/gmail-pubsub-credentials.json \
  --iam-account=gmail-pubsub-sa@mon-projet-id.iam.gserviceaccount.com

# Accorder les permissions Pub/Sub au compte de service
gcloud projects add-iam-policy-binding mon-projet-id \
  --member="serviceAccount:gmail-pubsub-sa@mon-projet-id.iam.gserviceaccount.com" \
  --role="roles/pubsub.admin"
```

**Important :** Stockez le fichier d'identifiants en toute sécurité. Ne le commitez jamais sur git. Ajoutez `*-credentials.json` à votre `.gitignore`.

##### 3. Créer le topic et l'abonnement Pub/Sub

```bash
# Créer le topic pour les notifications Gmail
gcloud pubsub topics create gmail-notifications

# Accorder à Gmail la permission de publier sur ce topic
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --role="roles/pubsub.publisher" \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com"

# Créer l'abonnement Pull
gcloud pubsub subscriptions create gmail-notifications-sub \
  --topic=gmail-notifications \
  --ack-deadline=60
```

##### 4. Configurer OAuth2 pour l'API Gmail

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Naviguez vers **APIs et services** → **Identifiants**
3. Cliquez sur **Créer des identifiants** → **ID client OAuth 2.0**
4. Choisissez **Application Web** ou **Application de bureau**
5. Ajoutez les URI de redirection autorisés (ex: `http://localhost:3000/auth/callback`)
6. Copiez l'**ID client** et le **Secret client**

Pour obtenir un refresh token, utilisez le OAuth2 playground ou implémentez un flux OAuth dans votre application.

##### 5. Configurer les variables d'environnement

Ajoutez à votre fichier `.env` :

```env
# Gmail OAuth2 (pour l'outil gmail_watch)
GMAIL_CLIENT_ID=votre-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=votre-client-secret

# Google Cloud Pub/Sub (pour gmail_pull_notifications)
GOOGLE_CLOUD_PROJECT_ID=mon-projet-id
GOOGLE_APPLICATION_CREDENTIALS=/chemin/absolu/vers/multi-agent/gmail-pubsub-credentials.json

# Optionnel : Si vous n'utilisez pas GOOGLE_APPLICATION_CREDENTIALS
# PUBSUB_CREDENTIALS_PATH=/chemin/absolu/vers/multi-agent/gmail-pubsub-credentials.json
```

**Note :** `GOOGLE_APPLICATION_CREDENTIALS` est la variable d'environnement standard de Google Cloud pour les Application Default Credentials (ADC). Si définie, le client Pub/Sub l'utilisera automatiquement. Vous pouvez aussi passer `credentialsPath` explicitement dans les appels d'outils.

##### 6. Configurer le service d'orchestration

Ajoutez à `services/orchestration-service/.env` :

```env
# Configuration du polling Gmail
GMAIL_POLLING_ENABLED=true
GMAIL_PUBSUB_PROJECT_ID=mon-projet-id
GMAIL_PUBSUB_SUBSCRIPTION=gmail-notifications-sub

# URL du service Email MCP
EMAIL_MCP_URL=http://localhost:3012

# Identifiants Google Cloud (identiques au email-mcp-service)
GOOGLE_APPLICATION_CREDENTIALS=/chemin/absolu/vers/multi-agent/gmail-pubsub-credentials.json
```

---

**Exemple de workflow :**

```bash
# 1. Démarrer la surveillance (enregistrement pour les notifications)
POST /api/tools/gmail/watch
{
  "refreshToken": "votre-oauth2-refresh-token",
  "topicName": "projects/mon-projet-id/topics/gmail-notifications"
}

# Réponse :
{
  "content": [{
    "type": "text",
    "text": "{\"success\":true,\"historyId\":\"1234567\",\"expiration\":\"1234567890000\"}"
  }]
}

# 2. Récupérer les notifications (automatisé via orchestration-service toutes les 30s)
POST /api/tools/gmail/pull-notifications
{
  "projectId": "mon-projet-id",
  "subscriptionName": "gmail-notifications-sub",
  "maxMessages": "10"
}

# Réponse :
{
  "content": [{
    "type": "text",
    "text": "{\"count\":2,\"notifications\":[{\"emailAddress\":\"utilisateur@gmail.com\",\"historyId\":\"1234567\"}]}"
  }]
}

# Optionnel : Passer les identifiants explicitement (si GOOGLE_APPLICATION_CREDENTIALS n'est pas défini)
POST /api/tools/gmail/pull-notifications
{
  "projectId": "mon-projet-id",
  "subscriptionName": "gmail-notifications-sub",
  "maxMessages": "10",
  "credentialsPath": "/chemin/absolu/vers/gmail-pubsub-credentials.json"
}
```

**Important :**

- La surveillance expire après **7 jours**. Vous devez rappeler `gmail_watch` pour la renouveler.
- Le service d'orchestration récupère automatiquement les notifications **toutes les 30 secondes**.
- Le chemin du fichier d'identifiants doit être **absolu**, pas relatif.
- Si vous utilisez Docker, montez le fichier d'identifiants et définissez le chemin vers l'emplacement monté.

---

### Dépannage Gmail Pub/Sub

**Problème : `gmail_pull_notifications` retourne toujours `{"processed": 0, "notifications": []}`**

**Liste de vérification :**

1. **Vérifier que l'abonnement existe :**

   ```bash
   gcloud pubsub subscriptions describe gmail-notifications-sub
   ```

   Si introuvable, créez-le :

   ```bash
   gcloud pubsub subscriptions create gmail-notifications-sub \
     --topic=gmail-notifications \
     --ack-deadline=60
   ```

2. **Vérifier que la surveillance Gmail est active :**

   ```bash
   POST /api/tools/gmail/watch
   {
     "refreshToken": "votre-oauth2-refresh-token",
     "topicName": "projects/mon-projet-id/topics/gmail-notifications"
   }
   ```

   Si vous voyez `"success": false`, votre surveillance a peut-être expiré (limite de 7 jours).

3. **Vérifier les identifiants :**
   - Assurez-vous que `GOOGLE_APPLICATION_CREDENTIALS` pointe vers un fichier JSON de compte de service valide
   - Testez les identifiants : `gcloud auth application-default print-access-token`

4. **Vérifier les permissions IAM Pub/Sub :**

   ```bash
   # Vérifier que le compte de service a le rôle Pub/Sub Admin
   gcloud projects get-iam-policy mon-projet-id \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:gmail-pubsub-sa@mon-projet-id.iam.gserviceaccount.com"

   # Vérifier que Gmail peut publier sur le topic
   gcloud pubsub topics get-iam-policy gmail-notifications
   ```

   Doit afficher `gmail-api-push@system.gserviceaccount.com` avec le rôle `roles/pubsub.publisher`.

5. **Tester la publication manuelle d'un message :**

   ```bash
   gcloud pubsub topics publish gmail-notifications \
     --message='{"emailAddress":"test@gmail.com","historyId":"12345"}'

   # Puis récupérer :
   POST /api/tools/gmail/pull-notifications
   {
     "projectId": "mon-projet-id",
     "subscriptionName": "gmail-notifications-sub",
     "maxMessages": "10"
   }
   ```

   Si cela fonctionne, le problème vient des notifications push Gmail, pas de la logique de pull.

6. **Vérifier les logs du service :**

   ```bash
   # Logs du service Email MCP
   docker logs email-mcp-service

   # Ou si exécuté localement :
   pnpm --filter @multi-agent/email-mcp-service dev
   ```

   Recherchez : `Pulling up to X messages from gmail-notifications-sub`

7. **Vérifier le type d'abonnement :**
   L'abonnement **doit** être de type **Pull**, pas **Push**. Vérifiez :

   ```bash
   gcloud pubsub subscriptions describe gmail-notifications-sub --format="value(pushConfig)"
   ```

   Doit être vide. Si vous voyez une URL, supprimez et recréez en Pull :

   ```bash
   gcloud pubsub subscriptions delete gmail-notifications-sub
   gcloud pubsub subscriptions create gmail-notifications-sub --topic=gmail-notifications
   ```

---

### Utilisation via JSON-RPC

L'endpoint MCP `POST /api/mcp` accepte des requêtes JSON-RPC 2.0. Préférez l'interface Swagger pour les tests manuels ; utilisez cet endpoint pour l'intégration avec les agents IA.

**Récupérer des emails :**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "gmail_fetch_emails",
    "arguments": {
      "mailbox": "INBOX",
      "limit": "20",
      "query": "subject:Candidature - Poste de Senior Developer"
    }
  }
}
```

**Tous les arguments de `gmail_fetch_emails` sont optionnels :**

| Argument   | Type   | Défaut          | Description                                                                         |
| ---------- | ------ | --------------- | ----------------------------------------------------------------------------------- |
| `mailbox`  | string | `INBOX`         | Boîte à lire. Dossiers Gmail : `[Gmail]/Sent Mail`, `[Gmail]/Spam`, `[Gmail]/Trash` |
| `limit`    | string | `20`            | Nombre d'emails les plus récents (max 100)                                          |
| `query`    | string | —               | Filtre de recherche `clé:valeur` (voir ci-dessous)                                  |
| `imapUser` | string | env `IMAP_USER` | Adresse Gmail à utiliser pour cette requête                                         |
| `imapPass` | string | env `IMAP_PASS` | Mot de passe d'application pour cette requête                                       |

**Syntaxe de requête** — paires `clé:valeur` séparées par des espaces :

| Clé       | Exemple                  | Description                        |
| --------- | ------------------------ | ---------------------------------- |
| `from`    | `from:alice@example.com` | Filtrer par expéditeur             |
| `to`      | `to:bob@example.com`     | Filtrer par destinataire           |
| `subject` | `subject:facture`        | Filtrer par mot-clé dans le sujet  |
| `text`    | `text:bonjour`           | Recherche dans le corps du message |
| `since`   | `since:2024-01-01`       | Emails après cette date            |
| `before`  | `before:2024-06-01`      | Emails avant cette date            |
