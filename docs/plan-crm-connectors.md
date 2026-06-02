# Plan d'implémentation — Connecteurs CRM : HubSpot & Pipedrive

## Objectif

Ajouter deux connecteurs CRM MCP (HubSpot et Pipedrive) permettant aux workflows IA de lire/écrire dans le CRM de l'utilisateur : recherche de contacts, gestion de deals, logging d'activités, et déclenchement de workflows sur événements CRM (deal gagné, contact créé, etc.). Ciblé sur le **vertical commercial** (équipes sales, RevOps).

---

## Contexte existant

| Existant | Pertinence |
|----------|-----------|
| Pattern MCP : `McpToolHandler` interface + `McpController` JSON-RPC 2.0 | À réutiliser à l'identique |
| `trello-mcp-service` (port 3011) — meilleur modèle à suivre | Même structure tool/controller/api-service |
| `calendar-mcp-service` — modèle OAuth2 par env var | Insuffisant pour multi-tenant — à adapter |
| `GmailWatchSubscription` + webhook trigger dans `email-mcp-service` | Pattern webhook → trigger workflow déjà éprouvé |
| `ApiKey.encryptedKey` — chiffrement AES en base | Pattern identique pour les credentials CRM |
| `proxy.controller.ts` — 12 cas `switch/case` existants | 2 cas à ajouter : `hubspot` et `pipedrive` |

**Ports libres :** 3019 → hubspot-mcp-service · 3021 → pipedrive-mcp-service  
(3015-3018 réservés par les plans précédents, 3020 = gateway-go)

---

## Ports réservés (ce plan)

| Service                  | Port |
|--------------------------|------|
| hubspot-mcp-service      | 3019 |
| pipedrive-mcp-service    | 3021 |

---

## Outils MCP exposés

### HubSpot (13 outils)

| Nom outil                         | Action                                           |
|-----------------------------------|--------------------------------------------------|
| `hubspot_search_contacts`         | Recherche par email, nom, entreprise             |
| `hubspot_get_contact`             | Détail d'un contact par ID ou email              |
| `hubspot_create_contact`          | Crée un contact avec ses propriétés              |
| `hubspot_update_contact`          | Met à jour les propriétés d'un contact           |
| `hubspot_search_companies`        | Recherche d'entreprises (nom, domaine)           |
| `hubspot_create_company`          | Crée une entreprise                              |
| `hubspot_get_deals`               | Liste les deals (filtre : pipeline, stage, owner)|
| `hubspot_create_deal`             | Crée un deal avec associations contact/company   |
| `hubspot_update_deal_stage`       | Déplace un deal dans le pipeline                 |
| `hubspot_create_note`             | Ajoute une note à un contact ou deal             |
| `hubspot_get_contact_timeline`    | Historique d'activités d'un contact              |
| `hubspot_get_pipelines`           | Liste les pipelines et leurs stages              |
| `hubspot_enrich_contact`          | Enrichit un contact via HubSpot Insights API     |

### Pipedrive (12 outils)

| Nom outil                         | Action                                            |
|-----------------------------------|---------------------------------------------------|
| `pipedrive_search_persons`        | Recherche de personnes (nom, email, org)          |
| `pipedrive_create_person`         | Crée une personne (contact)                       |
| `pipedrive_update_person`         | Met à jour les champs d'une personne              |
| `pipedrive_search_organizations`  | Recherche d'organisations                         |
| `pipedrive_create_organization`   | Crée une organisation                             |
| `pipedrive_get_deals`             | Liste les deals (filtre : pipeline, stage, owner) |
| `pipedrive_create_deal`           | Crée un deal avec association personne/org        |
| `pipedrive_update_deal_stage`     | Déplace un deal dans le pipeline                  |
| `pipedrive_create_activity`       | Crée une activité (appel, email, tâche, meeting)  |
| `pipedrive_get_activities`        | Liste les activités d'un deal ou d'une personne   |
| `pipedrive_get_pipelines`         | Liste les pipelines et leurs stages               |
| `pipedrive_add_note`              | Ajoute une note textuelle à un deal ou personne   |

---

## Architecture cible

```
[Utilisateur]
  └── OAuth2 → gateway → hubspot/pipedrive-mcp-service
      → échange code → CrmCredential stocké chiffré

[Workflow IA]
  └── node "HubSpot: Créer contact"
      → agent-service appelle /api/hubspot/mcp (JSON-RPC)
      → hubspot-mcp-service lit CrmCredential(userId)
      → appelle HubSpot API v3

[CRM Webhook → Trigger workflow]
  HubSpot webhook → POST /api/hubspot/webhook/:subscriptionId
  Pipedrive event → POST /api/pipedrive/webhook/:userId
  → hubspot/pipedrive-mcp-service vérifie signature
  → publie NATS 'crm.event.received'
  → orchestration-service déclenche le workflow lié
```

---

## Phase 1 — Base de données

### 1. `packages/database/prisma/schema.prisma`

```prisma
model CrmCredential {
  id                 String      @id @default(uuid())
  userId             String
  provider           CrmProvider
  // Tokens OAuth2 chiffrés AES-256-GCM (même pattern que ApiKey.encryptedKey)
  accessTokenEnc     String
  refreshTokenEnc    String?
  expiresAt          DateTime?
  // Identifiants côté CRM
  crmUserId          String?     // ID de l'utilisateur dans le CRM
  crmAccountId       String?     // Hub ID (HubSpot) ou Company ID (Pipedrive)
  crmAccountName     String?     // nom lisible
  // Scopes accordés
  scopes             String[]    @default([])
  isActive           Boolean     @default(true)
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt
  user               User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  webhookSubscriptions CrmWebhookSubscription[]

  @@unique([userId, provider])
  @@index([userId])
  @@index([provider])
  @@map("crm_credentials")
}

model CrmWebhookSubscription {
  id               String      @id @default(uuid())
  credentialId     String
  credential       CrmCredential @relation(fields: [credentialId], references: [id], onDelete: Cascade)
  workflowId       String
  // Événements souscrits (ex: "deal.stageChange", "contact.creation")
  eventTypes       String[]
  // ID de l'abonnement côté CRM (pour désabonnement)
  externalSubId    String?
  isActive         Boolean     @default(true)
  createdAt        DateTime    @default(now())
  workflow         Workflow    @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@index([credentialId])
  @@index([workflowId])
  @@map("crm_webhook_subscriptions")
}

enum CrmProvider { HUBSPOT PIPEDRIVE }
```

> Ajouter `crmCredentials CrmCredential[]` et `crmWebhookSubscriptions CrmWebhookSubscription[]` sur le modèle `User` et `Workflow`.

---

## Phase 2 — hubspot-mcp-service (nouveau microservice)

> Scaffolder avec `/create-service hubspot-mcp 3019 "Connecteur HubSpot CRM — contacts, deals, pipeline"`

### 2. Structure

```
services/hubspot-mcp-service/src/
├── domain/
│   └── hubspot-tool.interface.ts    # identique à trello-tool.interface.ts
├── infrastructure/
│   ├── config/
│   │   ├── configuration.ts
│   │   └── env.validation.ts
│   ├── auth/
│   │   ├── hubspot-oauth.service.ts  # échange code, refresh token
│   │   └── credential.service.ts    # lit/déchiffre CrmCredential en DB
│   └── hubspot/
│       └── hubspot-api.service.ts   # client axios vers HubSpot API v3
└── presentation/
    ├── controllers/
    │   ├── mcp.controller.ts         # JSON-RPC 2.0 (copier trello)
    │   └── hubspot-oauth.controller.ts
    └── tools/
        ├── search-contacts.tool.ts
        ├── get-contact.tool.ts
        ├── create-contact.tool.ts
        ├── update-contact.tool.ts
        ├── search-companies.tool.ts
        ├── create-company.tool.ts
        ├── get-deals.tool.ts
        ├── create-deal.tool.ts
        ├── update-deal-stage.tool.ts
        ├── create-note.tool.ts
        ├── get-contact-timeline.tool.ts
        ├── get-pipelines.tool.ts
        ├── enrich-contact.tool.ts
        └── index.ts
```

### 3. `infrastructure/auth/hubspot-oauth.service.ts`

```typescript
// authorize(userId: string): string
//   → URL OAuth HubSpot avec state = jwt_signed({ userId })
//   → scope: crm.objects.contacts.read+write, crm.objects.deals.read+write, ...

// handleCallback(code: string, state: string): Promise<void>
//   → POST https://api.hubapi.com/oauth/v1/token
//   → stocke accessToken + refreshToken chiffrés dans CrmCredential

// refreshIfNeeded(credential: CrmCredential): Promise<string>
//   → si expiresAt < now + 5min → appelle refresh endpoint
//   → MAJ CrmCredential.accessTokenEnc + expiresAt
```

### 4. `infrastructure/hubspot/hubspot-api.service.ts`

```typescript
// Constructeur : prend userId, résout le token via credential.service
// Méthodes mappées 1:1 avec les 13 outils
// Base URL : https://api.hubapi.com
// Headers : Authorization: Bearer <accessToken>
// Timeout : 15 000 ms
// Retry automatique sur 401 → refresh token + réessaie une fois
```

### 5. `presentation/controllers/hubspot-oauth.controller.ts`

```
GET /hubspot/connect?userId=     → redirige vers HubSpot OAuth (state signé JWT)
GET /hubspot/callback            → échange code → stocke credential → redirige /settings/integrations
GET /hubspot/status?userId=      → { connected, crmAccountName, scopes, expiresAt }
DELETE /hubspot/disconnect?userId= → révoque token + supprime CrmCredential
POST /hubspot/webhook/:credentialId → réception événements CRM (voir Phase 6)
```

### 6. Outil exemple — `tools/create-deal.tool.ts`

```typescript
schema(): McpToolSchema {
  return {
    name: 'hubspot_create_deal',
    description: 'Create a new deal in HubSpot with contact and company associations',
    inputSchema: {
      type: 'object',
      properties: {
        userId:      { type: 'string', description: 'Platform userId (required for auth)' },
        dealName:    { type: 'string', description: 'Name of the deal' },
        amount:      { type: 'number', description: 'Deal value in euros' },
        pipelineId:  { type: 'string', description: 'HubSpot pipeline ID' },
        stageId:     { type: 'string', description: 'Initial pipeline stage ID' },
        contactId:   { type: 'string', description: 'HubSpot contact ID to associate' },
        closeDate:   { type: 'string', description: 'Expected close date ISO 8601' },
      },
      required: ['userId', 'dealName', 'pipelineId', 'stageId'],
    },
  };
}
// execute : appelle hubspot-api.service.createDeal() avec le token de l'userId
```

> **Règle clé** : chaque outil reçoit `userId` dans ses `args` pour résoudre les credentials. Ne jamais passer de token en clair dans les arguments.

---

## Phase 3 — pipedrive-mcp-service (nouveau microservice)

> Scaffolder avec `/create-service pipedrive-mcp 3021 "Connecteur Pipedrive CRM — persons, deals, activities"`

### 7. Structure (miroir de hubspot-mcp-service)

```
services/pipedrive-mcp-service/src/
├── infrastructure/
│   ├── auth/
│   │   ├── pipedrive-oauth.service.ts
│   │   └── credential.service.ts       # même interface que hubspot
│   └── pipedrive/
│       └── pipedrive-api.service.ts    # client vers Pipedrive API v1
└── presentation/
    ├── controllers/
    │   ├── mcp.controller.ts
    │   └── pipedrive-oauth.controller.ts
    └── tools/
        ├── search-persons.tool.ts
        ├── create-person.tool.ts
        ├── update-person.tool.ts
        ├── search-organizations.tool.ts
        ├── create-organization.tool.ts
        ├── get-deals.tool.ts
        ├── create-deal.tool.ts
        ├── update-deal-stage.tool.ts
        ├── create-activity.tool.ts
        ├── get-activities.tool.ts
        ├── get-pipelines.tool.ts
        ├── add-note.tool.ts
        └── index.ts
```

### 8. `infrastructure/auth/pipedrive-oauth.service.ts`

```typescript
// Pipedrive OAuth 2.0 :
// authorize URL : https://oauth.pipedrive.com/oauth/authorize
// token URL : https://oauth.pipedrive.com/oauth/token
// Scopes : deals:full, contacts:full, activities:full, pipelines:read

// handleCallback : stocke tokens dans CrmCredential (même schéma)
// Pipedrive token TTL : 1h — même logique de refresh que HubSpot
```

### 9. `infrastructure/pipedrive/pipedrive-api.service.ts`

```typescript
// Base URL : https://api.pipedrive.com/v1
// Auth : ?api_token=<accessToken> (ou Bearer header selon version)
// Méthodes : searchPersons, createPerson, searchOrgs, getDeals,
//            createDeal, updateDeal, createActivity, getActivities, ...
```

### 10. `presentation/controllers/pipedrive-oauth.controller.ts`

```
GET /pipedrive/connect?userId=
GET /pipedrive/callback
GET /pipedrive/status?userId=
DELETE /pipedrive/disconnect?userId=
POST /pipedrive/webhook/:credentialId
```

---

## Phase 4 — gateway-service (modifications)

### 11. `infrastructure/config/env.validation.ts`

```typescript
HUBSPOT_MCP_SERVICE_URL: z.string().url().default('http://localhost:3019'),
PIPEDRIVE_MCP_SERVICE_URL: z.string().url().default('http://localhost:3021'),
// Variables OAuth (secrets, jamais exposés côté frontend)
HUBSPOT_CLIENT_ID: z.string(),
HUBSPOT_CLIENT_SECRET: z.string(),
PIPEDRIVE_CLIENT_ID: z.string(),
PIPEDRIVE_CLIENT_SECRET: z.string(),
CRM_CREDENTIAL_ENCRYPTION_KEY: z.string().min(32),  // AES-256
```

### 12. `presentation/controllers/proxy.controller.ts`

Ajouter dans le `router switch/case` :

```typescript
case 'hubspot':
  target = this.configService.get('HUBSPOT_MCP_SERVICE_URL', 'http://localhost:3019');
  break;
case 'pipedrive':
  target = this.configService.get('PIPEDRIVE_MCP_SERVICE_URL', 'http://localhost:3021');
  break;
```

Et deux méthodes `@All()` en bas du controller :

```typescript
@All('hubspot/*')
proxyHubspot(@Req() req, @Res() res, @Next() next) {
  return this.proxyMiddleware(req, res, next);
}

@All('pipedrive/*')
proxyPipedrive(@Req() req, @Res() res, @Next() next) {
  return this.proxyMiddleware(req, res, next);
}
```

### 13. Routes OAuth callback — publiques (`@Public()`)

Les callbacks OAuth doivent être publics (pas de JWT au retour de HubSpot/Pipedrive) :

```typescript
@Public()
@All(['hubspot/callback', 'pipedrive/callback'])
proxyOauthCallback(@Req() req, @Res() res, @Next() next) {
  return this.proxyMiddleware(req, res, next);
}
```

### 14. Routes webhook — publiques + validation signature dans le service

```typescript
@Public()
@All(['hubspot/webhook/*', 'pipedrive/webhook/*'])
proxyCrmWebhook(@Req() req, @Res() res, @Next() next) {
  return this.proxyMiddleware(req, res, next);
}
```

---

## Phase 5 — Frontend

### 15. `frontend/src/features/integrations/crm/` *(nouveau)*

```
features/integrations/crm/
├── components/
│   ├── CrmConnectionCard.tsx      # carte par provider : logo + statut + boutons
│   ├── HubSpotConnectButton.tsx   # redirige vers /api/hubspot/connect?userId=...
│   ├── PipedriveConnectButton.tsx
│   ├── CrmStatusBadge.tsx         # Connecté / Déconnecté / Expiré
│   └── CrmDisconnectModal.tsx     # confirmation avant révocation
├── hooks/
│   ├── useHubSpotStatus.ts        # SWR sur GET /api/hubspot/status
│   └── usePipedriveStatus.ts
└── index.ts
```

### 16. `frontend/app/(dashboard)/settings/integrations/page.tsx` *(nouveau ou extension)*

Section "CRM" sur la page des intégrations :

```
┌─────────────────────────────────────────────────────┐
│  CRM & Pipeline                                     │
├──────────────────────┬──────────────────────────────┤
│  [HubSpot logo]      │  [Pipedrive logo]            │
│  HubSpot             │  Pipedrive                   │
│  ● Connecté          │  ○ Non connecté              │
│  Compte: Mon Hub     │                              │
│  [Gérer] [Déconnecter]│ [Connecter]                 │
└──────────────────────┴──────────────────────────────┘
```

### 17. Nœuds de workflow CRM dans l'éditeur

Ajouter dans la palette de nœuds (feature flags : utilisateur connecté à au moins un CRM) :

**Catégorie "CRM" dans le panneau de nœuds :**

```
HubSpot
  ├── Rechercher un contact
  ├── Créer un contact
  ├── Créer un deal
  ├── Mettre à jour le stage
  └── Ajouter une note

Pipedrive
  ├── Rechercher une personne
  ├── Créer un deal
  ├── Mettre à jour le stage
  └── Créer une activité
```

Chaque nœud CRM passe `userId` automatiquement depuis le contexte d'exécution — jamais saisi manuellement.

### 18. Locales

```typescript
// frontend/src/locales/fr/integrations.ts  (étendre si existant)
// Clés : integrations.crm.hubspot.*, integrations.crm.pipedrive.*
// integrations.crm.connect, integrations.crm.disconnect,
// integrations.crm.connected, integrations.crm.notConnected

// frontend/src/locales/en/integrations.ts — identique EN
```

---

## Phase 6 — Triggers CRM (déclenchement de workflows)

### 19. Événements webhook HubSpot

Souscrire à ces événements lors de la connexion OAuth :

| Événement HubSpot        | Cas d'usage commercial                           |
|--------------------------|--------------------------------------------------|
| `contact.creation`       | Déclencher onboarding automatique nouveau lead   |
| `deal.creation`          | Notifier l'équipe + créer tâche de suivi         |
| `deal.stageChange`       | Envoyer email de félicitations si deal → Gagné   |
| `deal.propertyChange`    | Alerte si montant deal modifié                   |
| `contact.propertyChange` | Re-segmenter lead si secteur change              |

### 20. Événements webhook Pipedrive

| Événement Pipedrive      | Cas d'usage commercial                           |
|--------------------------|--------------------------------------------------|
| `deal.added`             | Créer tâche de qualification automatique         |
| `deal.updated` (stage)   | Déclencher séquence nurturing par stage          |
| `person.added`           | Enrichissement automatique depuis base externe   |
| `activity.added`         | Logguer dans audit trail commercial              |

### 21. `infrastructure/webhook/crm-webhook.handler.ts` (dans chaque service MCP)

```typescript
// POST /hubspot/webhook/:credentialId
// 1. Vérifie signature HMAC-SHA256 : X-HubSpot-Signature vs HUBSPOT_WEBHOOK_SECRET
// 2. Parse les événements (tableau — HubSpot peut batcher)
// 3. Pour chaque événement : publie NATS 'crm.event.received'
//    payload : { provider, eventType, objectId, credentialId, raw }
// 4. L'orchestration-service consomme et déclenche le workflow associé
//    via CrmWebhookSubscription (workflowId par credentialId × eventType)
```

### 22. Nœuds de trigger dans l'éditeur de workflows

**Catégorie "Trigger CRM" :**

```
Déclencheurs HubSpot
  ├── Nouveau contact créé
  ├── Deal stage changé
  └── Deal créé

Déclencheurs Pipedrive
  ├── Nouvelle personne ajoutée
  ├── Deal stage changé
  └── Activité créée
```

Ces nœuds trigger configurent une `CrmWebhookSubscription` à la sauvegarde du workflow.

---

## Templates de workflows pré-construits (vertical commercial)

Ajouter au marketplace (lié à `plan-subscriptions.md` section marketplace) :

| Template | Outils utilisés | Déclencheur |
|----------|----------------|-------------|
| **Lead enrichment auto** | HubSpot search → enrichir → update contact | `contact.creation` |
| **Deal won → notification Slack** | HubSpot stage → Slack send | `deal.stageChange` (won) |
| **Qualification IA de lead** | HubSpot get contact → Claude → update contact score | `deal.creation` |
| **Sync contact HubSpot ↔ Pipedrive** | HubSpot search → Pipedrive create person | Manuel / cron |
| **Relance automatique deal inactif** | Pipedrive get deals → filtre inactif >7j → email | Cron quotidien |

---

## Séquencement recommandé

```
Phase 1 (DB)
  ├→ Phase 2 (hubspot-mcp-service)   ← parallèle avec →  Phase 3 (pipedrive-mcp-service)
  └→ Phase 4 (gateway)               ← après Phase 2+3
       → Phase 5 (frontend)
           → Phase 6 (webhook triggers)
               → Templates marketplace
```

---

## Risques

| Risque | Mitigation |
|--------|------------|
| Token OAuth HubSpot expiré pendant l'exécution | Retry automatique sur 401 : refresh + réessai une fois dans `hubspot-api.service.ts` |
| `userId` manquant dans les args MCP | Validation Zod `.uuid()` obligatoire — renvoie erreur MCP si absent |
| Webhook HubSpot en POST sans auth JWT | Route `@Public()` + vérification HMAC-SHA256 obligatoire avant traitement |
| Pipedrive rate limit : 80 req/10s | Interceptor axios avec queue + retry-after header |
| CrmCredential révoqué côté CRM | `credential.service.ts` catch 401 → marque `isActive=false` + notifie NATS `crm.credential.revoked` |
| Données personnelles (email, nom, téléphone) dans les logs | Masquer les champs PII dans les logs MCP — seulement logger les IDs CRM |

---

## Hors scope (v1)

- Synchronisation bidirectionnelle temps réel (sync engine)
- Salesforce, Zoho CRM (v2)
- Champs personnalisés CRM (custom properties) — propriétés standard seulement en v1
- HubSpot Sequences et Workflows natifs (non-MCP)
- Import bulk (CSV → CRM)
- Pipedrive Insights / reporting natif
