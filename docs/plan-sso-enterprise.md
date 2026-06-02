# Plan d'implémentation — SSO SAML/OIDC & Contrats Enterprise

## Objectif

Permettre aux organisations Enterprise de s'authentifier via leur propre Identity Provider (SAML 2.0 ou OIDC), et débloquer les fonctionnalités Enterprise (quotas illimités, SLA contractuel, support dédié, on-premise) via un système de contrats gérés par l'admin plateforme.

---

## Contexte existant

- Auth actuelle : JWT local + social-login OAuth (Google/GitHub) dans `gateway-service`
- Plan ENTERPRISE existe déjà dans `plan-subscriptions.md` (SSO listé comme feature, billing-service port 3014)
- Schema Prisma : `User`, `Organization` (à confirmer), `Role` — aucun `SsoConfig` ni `Contract`
- Gateway proxyfie tous les services via `proxy.controller.ts`
- Ports utilisés : 3000 (gateway), 3002–3005, 3007–3008, 3010–3013, 3014 (billing-service prévu)

---

## Ports réservés (ce plan)

| Service         | Port |
|-----------------|------|
| sso-service     | 3015 |
| enterprise-service | 3016 |

---

## Architecture cible

```
[Frontend]
  ├── /settings/sso          → wizard de configuration SSO par org
  ├── /admin/enterprise      → gestion des contrats (ADMIN plateforme)
  └── /auth/sso/:orgSlug     → point d'entrée SSO (redirect vers IdP)

[gateway-service :3000]
  ├── /api/sso/*             → proxy → sso-service :3015
  ├── /api/enterprise/*      → proxy → enterprise-service :3016
  └── JwtStrategy            → enrichit le JWT avec { ssoProvider, contractTier, features[] }

[sso-service :3015]
  ├── GET  /sso/metadata/:orgId        → SP metadata XML (SAML)
  ├── POST /sso/saml/:orgId/acs        → Assertion Consumer Service
  ├── GET  /sso/oidc/:orgId/login      → redirect vers IdP OIDC
  ├── GET  /sso/oidc/:orgId/callback   → échange code → tokens → JWT plateforme
  ├── CRUD /sso/config/:orgId          → gestion config SSO (org admin)
  └── JIT provisioning                 → crée/met à jour User à la connexion

[enterprise-service :3016]
  ├── CRUD /enterprise/contracts       → contrats (plateforme ADMIN seulement)
  ├── GET  /enterprise/contracts/mine  → contrat actif de l'org courante
  ├── GET  /enterprise/features/:orgId → feature flags actifs
  └── POST /enterprise/onboarding      → déclenchement flow onboarding enterprise
```

---

## Phase 1 — Base de données

### 1. `packages/database/prisma/schema.prisma`

**Nouveaux modèles :**

```prisma
model SsoConfig {
  id            String    @id @default(cuid())
  organizationId String   @unique
  organization  Organization @relation(fields: [organizationId], references: [id])
  protocol      SsoProtocol  // SAML | OIDC
  // SAML fields
  idpMetadataUrl  String?
  idpCertificate  String?
  idpSsoUrl       String?
  idpEntityId     String?
  // OIDC fields
  discoveryUrl    String?
  clientId        String?
  clientSecretEnc String?  // chiffré AES-256 en base
  scopes          String[] @default(["openid","email","profile"])
  // Mapping attributs
  emailAttr       String   @default("email")
  firstNameAttr   String   @default("firstName")
  lastNameAttr    String   @default("lastName")
  groupsAttr      String?
  // Comportement
  forceSSO        Boolean  @default(false)  // désactive login/password
  jitProvisioning Boolean  @default(true)
  defaultRole     UserRole @default(USER)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum SsoProtocol { SAML OIDC }

model EnterpriseContract {
  id             String           @id @default(cuid())
  organizationId String           @unique
  organization   Organization     @relation(fields: [organizationId], references: [id])
  status         ContractStatus   @default(DRAFT)
  // Termes financiers
  monthlyFee     Int              // en centimes
  currency       String           @default("EUR")
  billingCycle   BillingCycle     @default(MONTHLY)
  startDate      DateTime
  endDate        DateTime?        // null = sans fin
  // Quotas custom (overrides le plan)
  maxAgents      Int              @default(-1)   // -1 = illimité
  maxExecutions  Int              @default(-1)
  maxUsers       Int              @default(-1)
  maxStorage     Int              @default(-1)   // en Mo, -1 = illimité
  // Features débloquées
  features       EnterpriseFeature[]
  // SLA
  slaTier        SlaTier          @default(STANDARD)
  supportEmail   String?
  // Métadonnées
  signedAt       DateTime?
  signedByEmail  String?
  notes          String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}

enum ContractStatus  { DRAFT ACTIVE SUSPENDED EXPIRED TERMINATED }
enum BillingCycle    { MONTHLY ANNUAL }
enum SlaTier         { STANDARD PREMIUM DEDICATED }
enum EnterpriseFeature {
  SSO
  AUDIT_LOGS
  CUSTOM_ROLES
  ON_PREMISE
  DEDICATED_SUPPORT
  ADVANCED_ANALYTICS
  WHITE_LABEL
  API_SLA_99_9
}
```

**Migration :**
```bash
pnpm prisma:migrate  # après ajout des modèles
```

---

## Phase 2 — sso-service (nouveau microservice)

> Scaffolder avec `/create-service sso 3015 "SSO SAML 2.0 et OIDC par organisation"`

### 2. Structure

```
services/sso-service/src/
├── domain/
│   ├── entities/sso-config.entity.ts
│   ├── entities/sso-session.entity.ts
│   └── services/
│       ├── saml-strategy.service.ts     # logique SAML SP
│       ├── oidc-strategy.service.ts     # logique OIDC consumer
│       └── jit-provisioning.service.ts  # crée/MAJ User
├── application/
│   ├── use-cases/
│   │   ├── initiate-saml-login.use-case.ts
│   │   ├── handle-saml-acs.use-case.ts
│   │   ├── initiate-oidc-login.use-case.ts
│   │   ├── handle-oidc-callback.use-case.ts
│   │   └── upsert-sso-config.use-case.ts
│   └── dto/
│       ├── upsert-sso-config.dto.ts
│       └── sso-attributes.dto.ts
├── infrastructure/
│   ├── saml/passport-saml.service.ts    # wraps passport-saml
│   ├── oidc/openid-client.service.ts    # wraps openid-client
│   ├── crypto/secret-encryption.service.ts  # AES-256 pour clientSecret
│   └── http/gateway-client.service.ts   # appelle gateway pour créer JWT
└── presentation/
    ├── controllers/
    │   ├── saml.controller.ts
    │   ├── oidc.controller.ts
    │   └── sso-config.controller.ts
    └── guards/org-admin.guard.ts
```

### 3. Dépendances npm

```bash
pnpm --filter sso-service add @node-saml/passport-saml openid-client passport-openidconnect
pnpm --filter sso-service add fast-xml-parser  # lecture metadata IdP
```

### 4. `domain/services/saml-strategy.service.ts`

```typescript
// Génère la SP metadata XML, valide les assertions SAML
// Extrait les attributs selon le mapping de SsoConfig
// Retourne SsoAttributesDto normalisé
```

### 5. `domain/services/jit-provisioning.service.ts`

```typescript
// Logique : findOrCreate User par email
// Si existant : MAJ firstName/lastName/avatar, lie ssoProvider
// Si nouveau : crée avec defaultRole de SsoConfig
// NATS event : 'user.sso-provisioned' pour audit log
```

### 6. `presentation/controllers/saml.controller.ts`

```
GET  /sso/metadata/:orgId      → retourne XML SP metadata (public)
GET  /sso/saml/:orgId/login    → initie la redirection vers IdP
POST /sso/saml/:orgId/acs      → reçoit SAMLResponse, émet JWT plateforme
```

### 7. `presentation/controllers/oidc.controller.ts`

```
GET /sso/oidc/:orgId/login     → redirect vers IdP OIDC
GET /sso/oidc/:orgId/callback  → échange code, émet JWT plateforme
```

### 8. `presentation/controllers/sso-config.controller.ts`

```
GET    /sso/config/:orgId      → lecture config (org admin)
PUT    /sso/config/:orgId      → création/MAJ config
DELETE /sso/config/:orgId      → suppression
POST   /sso/config/:orgId/test → test connexion IdP (dry-run)
```

---

## Phase 3 — enterprise-service (nouveau microservice)

> Scaffolder avec `/create-service enterprise 3016 "Contrats Enterprise et feature flags"`

### 9. Structure

```
services/enterprise-service/src/
├── domain/
│   ├── entities/enterprise-contract.entity.ts
│   └── services/
│       ├── feature-flags.service.ts     # calcule features actives
│       └── quota-override.service.ts    # retourne quotas effectifs (contrat > plan)
├── application/
│   ├── use-cases/
│   │   ├── create-contract.use-case.ts
│   │   ├── activate-contract.use-case.ts
│   │   ├── get-org-contract.use-case.ts
│   │   └── get-org-features.use-case.ts
│   └── dto/
│       └── create-contract.dto.ts
├── infrastructure/
│   └── billing/billing-client.service.ts  # notifie billing-service des quotas
└── presentation/
    ├── controllers/
    │   ├── contracts.controller.ts       # CRUD (ADMIN plateforme)
    │   └── features.controller.ts        # GET features/quotas (tous services)
    └── guards/platform-admin.guard.ts
```

### 10. `domain/services/feature-flags.service.ts`

```typescript
// Priorité : EnterpriseContract > Plan abonnement > defaults
// Retourne EnterpriseFeature[] depuis contrat actif
// Cache Redis 5 min (TTL court car activation immédiate attendue)
```

### 11. `presentation/controllers/contracts.controller.ts`

```
POST   /enterprise/contracts              → crée contrat (ADMIN)
GET    /enterprise/contracts              → liste tous (ADMIN)
GET    /enterprise/contracts/:id          → détail (ADMIN)
PUT    /enterprise/contracts/:id          → MAJ (ADMIN)
POST   /enterprise/contracts/:id/activate → active le contrat (ADMIN)
GET    /enterprise/contracts/mine         → contrat actif org courante
GET    /enterprise/features/:orgId        → features actives (inter-service)
```

---

## Phase 4 — gateway-service (modifications)

### 12. `infrastructure/config/env.validation.ts`

```typescript
SSO_SERVICE_URL: z.string().url().default('http://localhost:3015'),
ENTERPRISE_SERVICE_URL: z.string().url().default('http://localhost:3016'),
```

### 13. `presentation/controllers/proxy.controller.ts`

Ajouter deux cas :

```typescript
case 'sso':
  return this.proxyTo(this.ssoServiceUrl, path, req);
case 'enterprise':
  return this.proxyTo(this.enterpriseServiceUrl, path, req);
```

### 14. `infrastructure/auth/jwt.strategy.ts`

Enrichir le payload JWT avec les données enterprise :

```typescript
// Dans validate() : appel lazy (cache) vers enterprise-service
// pour ajouter { contractTier, features[], ssoProvider } au user courant
```

### 15. `presentation/guards/sso-enforced.guard.ts` *(nouveau)*

```typescript
// Vérifie : si l'org a forceSSO=true et que l'utilisateur
// n'est pas connecté via SSO → 403 avec message SSO_REQUIRED
```

---

## Phase 5 — Frontend

### 16. `frontend/src/features/sso/` *(nouveau)*

```
features/sso/
├── components/
│   ├── SsoSetupWizard.tsx         # wizard 3 étapes : protocole → config → test
│   ├── SamlConfigForm.tsx         # formulaire SAML (metadata URL ou XML)
│   ├── OidcConfigForm.tsx         # formulaire OIDC (discovery URL, clientId)
│   └── SsoStatusBadge.tsx         # actif / inactif / en test
├── hooks/
│   └── useSsoConfig.ts
└── index.ts
```

### 17. `frontend/src/app/(app)/settings/sso/page.tsx` *(nouveau)*

- Accès : org admin + feature SSO débloquée
- Affiche `SsoSetupWizard` si pas de config, sinon `SsoStatusBadge` + édition
- Lien vers SP metadata XML pour enregistrement côté IdP

### 18. `frontend/src/features/enterprise/` *(nouveau)*

```
features/enterprise/
├── components/
│   ├── ContractList.tsx            # tableau des contrats (ADMIN)
│   ├── ContractForm.tsx            # création/édition contrat
│   ├── FeatureFlagsPanel.tsx       # toggle features Enterprise
│   └── ContractStatusChip.tsx
├── hooks/
│   └── useEnterpriseContract.ts
└── index.ts
```

### 19. `frontend/src/app/(admin)/enterprise/page.tsx` *(nouveau)*

- Accès : rôle ADMIN plateforme seulement
- CRUD contrats, activation, feature toggles

### 20. `frontend/src/features/auth/` — bouton SSO

Ajouter sur `/auth/login` :

```tsx
{/* Si l'org est détectée par subdomain ou email domain → bouton SSO */}
<Button onClick={() => router.push(`/api/sso/saml/${orgSlug}/login`)}>
  {t('auth.continueWithSso')}
</Button>
```

### 21. Locales

```
frontend/src/locales/en/sso.ts
frontend/src/locales/fr/sso.ts
frontend/src/locales/en/enterprise.ts
frontend/src/locales/fr/enterprise.ts
```

Enregistrer dans `src/locales/{en,fr}/index.ts`.

---

## Phase 6 — Sécurité & enforcement

### 22. Chiffrement des secrets OIDC

- `clientSecret` stocké chiffré AES-256-GCM dans `SsoConfig.clientSecretEnc`
- Clé de chiffrement dans env var `SSO_ENCRYPTION_KEY` (32 bytes, jamais en DB)
- Déchiffrement uniquement dans `sso-service` à l'exécution du flow OIDC

### 23. Validation des certificats SAML

- Vérifier la signature de chaque SAMLResponse avec le certificat IdP configuré
- Rejeter les assertions expirées (vérifier `NotBefore` / `NotOnOrAfter`)
- Logger chaque tentative échouée sur NATS : `audit.sso-failure`

### 24. Rate limiting SSO endpoints

```typescript
@Throttle({ default: { limit: 10, ttl: 60000 } })
// Sur POST /sso/saml/:orgId/acs et GET /sso/oidc/:orgId/callback
```

### 25. Audit NATS events

| Event                   | Émis par            |
|-------------------------|---------------------|
| `sso.login.success`     | sso-service         |
| `sso.login.failure`     | sso-service         |
| `sso.user.provisioned`  | sso-service         |
| `enterprise.contract.activated` | enterprise-service |
| `enterprise.feature.toggled`    | enterprise-service |

---

## Séquencement recommandé

```
Phase 1 (DB)     → Phase 2 (sso-service)     → Phase 4 (gateway sso)
                 → Phase 3 (enterprise-service) → Phase 4 (gateway enterprise)
Phase 4 → Phase 5 (frontend) → Phase 6 (sécurité)
```

Phase 2 et Phase 3 sont **parallélisables**.

---

## Risques

| Risque | Mitigation |
|--------|------------|
| SAML XML parsing vulnérabilités (XXE, replay) | Utiliser `@node-saml/passport-saml` v4+ (corrige XXE) + vérifier InResponseTo |
| clientSecret OIDC en base | Chiffrement AES-256-GCM obligatoire dès le début (Phase 2) |
| forceSSO bloque l'admin en cas de panne IdP | Garder un compte admin plateforme avec login/password, bypass SSO enforcement |
| SP metadata URL exposée publiquement | Normal et nécessaire — ne contient aucun secret |
| Activation contrat → race condition avec billing-service | Utiliser un event NATS `enterprise.contract.activated` pour notifier billing |

---

## Hors scope (v1)

- SCIM provisioning automatique (synchronisation groupes depuis IdP)
- Multi-IdP par organisation (un seul IdP actif à la fois)
- IdP-initiated flow (uniquement SP-initiated en v1)
- Signature des requêtes SAML outbound (AuthnRequest)
- On-premise deployment automation (manuel en v1)
