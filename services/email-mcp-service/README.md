# Email MCP Service / Service Email MCP

## English

This service exposes email operations as MCP tools over JSON-RPC, and also provides a REST API with a full **Swagger UI** for direct testing.

### Swagger UI (Testing)

Start the service, then open:

```
http://localhost:3012/api/docs
```

Every tool has a dedicated REST endpoint you can call directly from the browser — no JSON-RPC wrapper needed. Fill in the form fields and click **Execute**.

| Tag | Endpoint | Tool |
|-----|----------|------|
| Gmail — IMAP | `POST /api/tools/gmail/fetch-emails` | `gmail_fetch_emails` |
| Gmail — IMAP | `POST /api/tools/gmail/manipulate-emails` | `gmail_manipulate_emails` |
| Gmail — IMAP | `POST /api/tools/gmail/list-attachments` | `gmail_list_attachments` |
| Gmail — IMAP | `POST /api/tools/gmail/download-attachment` | `gmail_download_attachment` |
| Email — SMTP | `POST /api/tools/email/send` | `email_send` |
| Email — SMTP | `POST /api/tools/email/send-template` | `email_send_template` |
| Email — SMTP | `POST /api/tools/email/verify-smtp` | `email_verify_smtp` |
| MCP — JSON-RPC | `POST /api/mcp` | raw JSON-RPC 2.0 |

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

| Tool | Description |
|------|-------------|
| `email_send` | Send an email via SMTP (plain text or HTML body) |
| `email_send_template` | Send an email using a `{{variable}}` template |
| `email_verify_smtp` | Verify that SMTP credentials can connect |
| `gmail_fetch_emails` | Fetch emails from a Gmail inbox via IMAP |
| `gmail_manipulate_emails` | Mark emails as read/unread, move, or delete by UID |
| `gmail_list_attachments` | List all attachments for an email UID |
| `gmail_download_attachment` | Download an attachment as base64 by UID + partId |

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

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `mailbox` | string | `INBOX` | Mailbox to read. Gmail system folders: `[Gmail]/Sent Mail`, `[Gmail]/Spam`, `[Gmail]/Trash`, `[Gmail]/All Mail` |
| `limit` | string | `20` | Number of most-recent emails to return (max 100) |
| `query` | string | — | Search filter using `key:value` pairs (see below) |
| `imapUser` | string | `IMAP_USER` env | Override Gmail address per-request |
| `imapPass` | string | `IMAP_PASS` env | Override App Password per-request |
| `imapHost` | string | `imap.gmail.com` | Override IMAP host |
| `imapPort` | string | `993` | Override IMAP port |

**Query syntax** — space-separated `key:value` pairs:

| Key | Example | Description |
|-----|---------|-------------|
| `from` | `from:alice@example.com` | Filter by sender |
| `to` | `to:bob@example.com` | Filter by recipient |
| `subject` | `subject:invoice` | Filter by subject keyword |
| `text` | `text:hello` | Full-body text search |
| `since` | `since:2024-01-01` | Emails after this date |
| `before` | `before:2024-06-01` | Emails before this date |

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

| Tag | Endpoint | Outil |
|-----|----------|-------|
| Gmail — IMAP | `POST /api/tools/gmail/fetch-emails` | `gmail_fetch_emails` |
| Gmail — IMAP | `POST /api/tools/gmail/manipulate-emails` | `gmail_manipulate_emails` |
| Gmail — IMAP | `POST /api/tools/gmail/list-attachments` | `gmail_list_attachments` |
| Gmail — IMAP | `POST /api/tools/gmail/download-attachment` | `gmail_download_attachment` |
| Email — SMTP | `POST /api/tools/email/send` | `email_send` |
| Email — SMTP | `POST /api/tools/email/send-template` | `email_send_template` |
| Email — SMTP | `POST /api/tools/email/verify-smtp` | `email_verify_smtp` |
| MCP — JSON-RPC | `POST /api/mcp` | JSON-RPC 2.0 brut |

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

| Outil | Description |
|-------|-------------|
| `email_send` | Envoyer un email via SMTP (texte brut ou HTML) |
| `email_send_template` | Envoyer un email avec un modèle `{{variable}}` |
| `email_verify_smtp` | Vérifier que les identifiants SMTP fonctionnent |
| `gmail_fetch_emails` | Récupérer des emails depuis une boîte Gmail via IMAP |
| `gmail_manipulate_emails` | Marquer comme lu/non-lu, déplacer ou supprimer par UID |
| `gmail_list_attachments` | Lister les pièces jointes d'un email par UID |
| `gmail_download_attachment` | Télécharger une pièce jointe en base64 par UID + partId |

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

| Argument | Type | Défaut | Description |
|----------|------|--------|-------------|
| `mailbox` | string | `INBOX` | Boîte à lire. Dossiers Gmail : `[Gmail]/Sent Mail`, `[Gmail]/Spam`, `[Gmail]/Trash` |
| `limit` | string | `20` | Nombre d'emails les plus récents (max 100) |
| `query` | string | — | Filtre de recherche `clé:valeur` (voir ci-dessous) |
| `imapUser` | string | env `IMAP_USER` | Adresse Gmail à utiliser pour cette requête |
| `imapPass` | string | env `IMAP_PASS` | Mot de passe d'application pour cette requête |

**Syntaxe de requête** — paires `clé:valeur` séparées par des espaces :

| Clé | Exemple | Description |
|-----|---------|-------------|
| `from` | `from:alice@example.com` | Filtrer par expéditeur |
| `to` | `to:bob@example.com` | Filtrer par destinataire |
| `subject` | `subject:facture` | Filtrer par mot-clé dans le sujet |
| `text` | `text:bonjour` | Recherche dans le corps du message |
| `since` | `since:2024-01-01` | Emails après cette date |
| `before` | `before:2024-06-01` | Emails avant cette date |
