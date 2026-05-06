# Calendar MCP Service / Service Calendar MCP

## English

This service manages Google Calendar events.

### Configuration

To configure the service, create a `.env` file in this directory based on `.env.example`.

#### Google Calendar Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Enable the **Google Calendar API**.
4. Go to **APIs & Services > Credentials**.
5. Configure the **OAuth Consent Screen** if you haven't already.
6. Create **OAuth 2.0 Client IDs** (Application type: Desktop or Web).
7. Copy the **Client ID** and **Client Secret** to `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
8. Obtain a `GOOGLE_OAUTH_REFRESH_TOKEN`. You can use the [Google OAuth2 Playground](https://developers.google.com/oauthplayground/) for this purpose.

```env
# Server Configuration
CALENDAR_MCP_PORT=3013
NODE_ENV=development

# Google Calendar Configuration
GOOGLE_CALENDAR_ID=primary
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REFRESH_TOKEN=your-refresh-token
```

---

## Français

Ce service gère les événements Google Calendar.

### Configuration

Pour configurer le service, créez un fichier `.env` dans ce répertoire en vous basant sur `.env.example`.

#### Configuration Google Calendar

1. Allez sur la [Console Google Cloud](https://console.cloud.google.com/).
2. Créez un nouveau projet ou sélectionnez-en un existant.
3. Activez l'**API Google Calendar**.
4. Allez dans **API et services > Identifiants**.
5. Configurez l'**Écran de consentement OAuth** si ce n'est pas déjà fait.
6. Créez des **Identifiants client OAuth 2.0** (Type d'application : Bureau ou Web).
7. Copiez l'**ID client** et le **Secret client** dans `GOOGLE_OAUTH_CLIENT_ID` et `GOOGLE_OAUTH_CLIENT_SECRET`.
8. Obtenez un `GOOGLE_OAUTH_REFRESH_TOKEN`. Vous pouvez utiliser le [Google OAuth2 Playground](https://developers.google.com/oauthplayground/) à cette fin.

```env
# Configuration du Serveur
CALENDAR_MCP_PORT=3013
NODE_ENV=development

# Configuration Google Calendar
GOOGLE_CALENDAR_ID=primary
GOOGLE_OAUTH_CLIENT_ID=votre-client-id
GOOGLE_OAUTH_CLIENT_SECRET=votre-client-secret
GOOGLE_OAUTH_REFRESH_TOKEN=votre-refresh-token
```
