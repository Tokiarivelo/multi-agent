# Email MCP Service / Service Email MCP

## English

This service exposes email operations as MCP tools over JSON-RPC.

### Available Tools

| Tool                  | Description                                      |
| --------------------- | ------------------------------------------------ |
| `email_send`          | Send an email via SMTP (plain text or HTML body) |
| `email_send_template` | Send an email using a predefined template        |
| `email_verify_smtp`   | Verify that SMTP credentials can connect         |
| `gmail_fetch_emails`  | Fetch emails from a Gmail inbox via IMAP         |

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

#### IMAP Configuration (fetching — `gmail_fetch_emails` tool)

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

### Using the `gmail_fetch_emails` Tool

Call the tool via the MCP JSON-RPC endpoint `POST /mcp`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "gmail_fetch_emails",
    "arguments": {
      "mailbox": "INBOX",
      "limit": "20"
    }
  }
}
```

**All arguments are optional:**

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

Example — last 5 emails from Alice about invoices:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "gmail_fetch_emails",
    "arguments": {
      "limit": "5",
      "query": "from:alice@example.com subject:invoice"
    }
  }
}
```

**Response shape:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"count\": 1,\n  \"emails\": [\n    {\n      \"uid\": 4201,\n      \"subject\": \"Invoice #42\",\n      \"from\": \"Alice <alice@example.com>\",\n      \"to\": \"you@gmail.com\",\n      \"date\": \"2024-03-15T10:22:00.000Z\",\n      \"snippet\": \"Hi, please find attached...\"\n    }\n  ]\n}"
      }
    ]
  }
}
```

---

### List all available tools

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

Ce service expose des opérations d'email en tant qu'outils MCP via JSON-RPC.

### Outils disponibles

| Outil                 | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `email_send`          | Envoyer un email via SMTP (texte brut ou HTML)       |
| `email_send_template` | Envoyer un email avec un modèle prédéfini            |
| `email_verify_smtp`   | Vérifier que les identifiants SMTP fonctionnent      |
| `gmail_fetch_emails`  | Récupérer des emails depuis une boîte Gmail via IMAP |

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

#### Configuration IMAP (récupération — outil `gmail_fetch_emails`)

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

### Utilisation de l'outil `gmail_fetch_emails`

Appelez l'outil via l'endpoint JSON-RPC `POST /mcp` :

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "gmail_fetch_emails",
    "arguments": {
      "mailbox": "INBOX",
      "limit": "20"
    }
  }
}
```

**Tous les arguments sont optionnels :**

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
