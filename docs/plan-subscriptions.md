# Plan d'implémentation — Abonnements & Monétisation

## Objectif

Introduire 4 paliers d'abonnement récurrent (Free / Pro / Business / Enterprise) + un système de services ponctuels, avec paiement Stripe, quotas enforced à chaque action, et une interface utilisateur complète (page pricing, portail de facturation, blockers UI).

---

## Limites par palier (source de vérité)

| Palier | Prix | Agents | Exéc/mois | Utilisateurs | LLMs | Extras |
|--------|------|--------|-----------|-------------|------|--------|
| FREE | 0 € | 2 | 100 | 1 | Modèles de base | — |
| PRO | 49 €/mois · 39 €/an | 10 | 5 000 | 3 | Tous | — |
| BUSINESS | 199 €/mois · 159 €/an | ∞ | 50 000 | 20 | Tous | SSO, Analytics |
| ENTERPRISE | Devis ≥ 500 €/mois | ∞ | ∞ | ∞ | Tous | On-premise, SLA, Support |
| SERVICES | 800 – 4 000 €/mission | — | — | — | — | Onboarding, Formation, Workflow sur mesure |

`-1` = illimité en base de données.

---

## Contexte existant

- `User` a `role: UserRole (ADMIN/USER/VIEWER)` — pas de concept de plan ni d'organisation multi-users
- Aucune intégration Stripe existante
- Aucun compteur d'utilisation mensuel
- La landing page existe (`features/landing/`) mais sans pricing
- Les services sont NestJS avec gateway proxy — le pattern de nouveau microservice est documenté

---

## Architecture cible

```
[Frontend]
  ├── /pricing          → page publique
  ├── /settings/billing → portail abonnement
  └── Upgrade modal     → déclenché par quota guard

[gateway-service]  → proxyfie /api/billing/* vers billing-service
                   → injecte planContext dans le JWT (plan, quotas restants)

[billing-service]  (port 3014 — nouveau)
  ├── Stripe Checkout & Customer Portal
  ├── Stripe Webhook handler (/api/billing/stripe/webhook — public)
  ├── Plan limits service (lecture des compteurs)
  └── Usage tracker (incrémente après chaque exécution)

[orchestration-service]
  └── PlanGuard → vérifie quota exec avant lancement
  
[agent-service]
  └── PlanGuard → vérifie quota agents avant création
```

---

## Phase 1 — Database

### 1. `packages/database/prisma/schema.prisma`

**a) Enum Plan**
```prisma
enum Plan {
  FREE
  PRO
  BUSINESS
  ENTERPRISE
}

enum BillingCycle {
  MONTHLY
  ANNUAL
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
  INCOMPLETE
}

enum ServiceOrderStatus {
  PENDING
  QUOTED
  IN_PROGRESS
  DELIVERED
  CANCELED
}

enum ServiceOrderType {
  ONBOARDING
  CUSTOM_WORKFLOW
  TRAINING
  OTHER
}
```

**b) Organization** — socle pour les plans multi-users (Pro 3, Business 20)
```prisma
model Organization {
  id                   String             @id @default(uuid())
  name                 String
  ownerId              String
  plan                 Plan               @default(FREE)
  stripeCustomerId     String?            @unique
  stripeSubscriptionId String?            @unique
  subscriptionStatus   SubscriptionStatus @default(ACTIVE)
  billingCycle         BillingCycle       @default(MONTHLY)
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  owner                User               @relation("OrgOwner", fields: [ownerId], references: [id])
  members              OrganizationMember[]
  usageRecords         UsageRecord[]
  serviceOrders        ServiceOrder[]

  @@index([ownerId])
  @@index([stripeCustomerId])
  @@map("organizations")
}
```

**c) OrganizationMember**
```prisma
model OrganizationMember {
  id             String       @id @default(uuid())
  organizationId String
  userId         String
  role           OrgMemberRole @default(MEMBER)
  joinedAt       DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@map("organization_members")
}

enum OrgMemberRole {
  OWNER
  ADMIN
  MEMBER
}
```

**d) UsageRecord** — compteur mensuel par organisation
```prisma
model UsageRecord {
  id             String       @id @default(uuid())
  organizationId String
  month          String       // "2026-05" — clé de réinitialisation mensuelle
  executionCount Int          @default(0)
  agentCount     Int          @default(0)
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, month])
  @@index([organizationId])
  @@map("usage_records")
}
```

**e) ServiceOrder** — services ponctuels
```prisma
model ServiceOrder {
  id             String             @id @default(uuid())
  organizationId String?
  userId         String
  type           ServiceOrderType
  status         ServiceOrderStatus @default(PENDING)
  description    String
  budget         String?            // "800-4000"
  priceQuoted    Float?
  contactEmail   String
  metadata       Json?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  organization   Organization?      @relation(fields: [organizationId], references: [id])
  user           User               @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
  @@map("service_orders")
}
```

**f) Modifications User**
```prisma
model User {
  // ... champs existants ...
  organizationId String?          // null = plan Free personnel
  organization   Organization?    @relation("OrgOwner")
  orgMemberships OrganizationMember[]
  serviceOrders  ServiceOrder[]
}
```

Migration : `pnpm prisma:migrate` — nom : `add_subscriptions_and_organizations`

---

## Phase 2 — billing-service (nouveau microservice)

> Utiliser `/create-service billing 3014 "Gestion des abonnements Stripe et des quotas"`.

### 2. Structure du service

```
billing-service/src/
  domain/
    entities/        plan-limits.entity.ts
    services/        plan-limits.service.ts
                     usage-tracker.service.ts
  application/
    dto/             create-checkout-session.dto.ts
                     create-service-order.dto.ts
    use-cases/       create-checkout-session.use-case.ts
                     handle-stripe-webhook.use-case.ts
                     get-billing-status.use-case.ts
  infrastructure/
    stripe/          stripe.service.ts
    config/          env.validation.ts
  presentation/
    controllers/     billing.controller.ts
                     stripe-webhook.controller.ts  (public — pas de JWT)
                     service-order.controller.ts
```

### 3. `domain/entities/plan-limits.entity.ts`

Source de vérité unique des limites — importable par tous les services :

```typescript
export const PLAN_LIMITS = {
  FREE:       { maxAgents: 2,  maxExecutionsPerMonth: 100,    maxUsers: 1,  allLlms: false, sso: false, analytics: false },
  PRO:        { maxAgents: 10, maxExecutionsPerMonth: 5_000,  maxUsers: 3,  allLlms: true,  sso: false, analytics: false },
  BUSINESS:   { maxAgents: -1, maxExecutionsPerMonth: 50_000, maxUsers: 20, allLlms: true,  sso: true,  analytics: true  },
  ENTERPRISE: { maxAgents: -1, maxExecutionsPerMonth: -1,     maxUsers: -1, allLlms: true,  sso: true,  analytics: true  },
} as const satisfies Record<Plan, PlanLimits>;
```

`-1` = illimité — **jamais vérifier `=== -1` dans les guards, utiliser `isUnlimited(limit)`**.

### 4. `domain/services/plan-limits.service.ts`

```typescript
@Injectable()
export class PlanLimitsService {
  async checkExecutionQuota(organizationId: string): Promise<QuotaCheckResult>
  async checkAgentQuota(organizationId: string): Promise<QuotaCheckResult>
  async checkUserQuota(organizationId: string): Promise<QuotaCheckResult>
  async getPlanForOrg(organizationId: string): Promise<Plan>
}

interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;      // -1 si illimité
  plan: Plan;
}
```

### 5. `domain/services/usage-tracker.service.ts`

```typescript
// Incrémente le compteur du mois en cours (upsert sur UsageRecord)
async incrementExecution(organizationId: string): Promise<void>
async incrementAgentCount(organizationId: string): Promise<void>
async decrementAgentCount(organizationId: string): Promise<void>
async getCurrentUsage(organizationId: string): Promise<UsageRecord>
```

Réinitialisation mensuelle : automatique par clé `month = "YYYY-MM"`, pas de cron nécessaire.

### 6. `infrastructure/stripe/stripe.service.ts`

```typescript
@Injectable()
export class StripeService {
  // Crée une session Checkout pour upgrade
  async createCheckoutSession(dto: CreateCheckoutSessionDto): Promise<string> // returns URL

  // Crée un lien vers le Customer Portal (gérer carte, annuler)
  async createPortalSession(stripeCustomerId: string): Promise<string> // returns URL

  // Vérifie la signature du webhook Stripe
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event
}
```

**Env vars nécessaires :**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_ANNUAL=price_...
```

### 7. `presentation/controllers/stripe-webhook.controller.ts`

Endpoint `@Public() POST /billing/stripe/webhook` :
- Vérifie la signature HMAC Stripe (`stripe.webhooks.constructEvent`)
- Traite les événements :
  - `checkout.session.completed` → crée/met à jour l'`Organization`, plan, stripeCustomerId
  - `customer.subscription.updated` → met à jour `plan`, `currentPeriodEnd`, `cancelAtPeriodEnd`
  - `customer.subscription.deleted` → downgrade vers FREE
  - `invoice.payment_failed` → `subscriptionStatus = PAST_DUE` + envoyer email

### 8. `presentation/controllers/billing.controller.ts`

Endpoints authentifiés :

| Méthode | Route | Action |
|---------|-------|--------|
| `GET` | `/billing/status` | Plan actuel, usage du mois, date de renouvellement |
| `POST` | `/billing/checkout` | Créer une session Stripe Checkout → URL de paiement |
| `POST` | `/billing/portal` | Créer lien Customer Portal |
| `GET` | `/billing/plans` | Lister tous les paliers et leurs limites (public) |

### 9. `presentation/controllers/service-order.controller.ts`

| Méthode | Route | Action |
|---------|-------|--------|
| `POST` | `/billing/services` | Soumettre une demande de service ponctuel |
| `GET` | `/billing/services` | Historique des commandes de l'utilisateur |

La soumission envoie un email à l'équipe commerciale via `email-mcp-service`.

### 10. `services/gateway-service/src/infrastructure/config/env.validation.ts`

Ajouter :
```typescript
BILLING_SERVICE_URL?: string = 'http://localhost:3014';
```

### 11. `services/gateway-service/src/presentation/controllers/proxy.controller.ts`

Ajouter dans le switch :
```typescript
case 'billing':   // → BILLING_SERVICE_URL
  break;
```

La route webhook Stripe est `@Public()` dans billing-service — s'assurer qu'elle bypass aussi le JWT du gateway.

---

## Phase 3 — Enforcement dans les services existants

> Le principe : **les guards lisent le quota via un appel HTTP au billing-service** — ils ne lisent jamais directement Prisma pour éviter la duplication de logique.

### 12. `services/orchestration-service/src/presentation/guards/execution-quota.guard.ts` *(nouveau)*

```typescript
@Injectable()
export class ExecutionQuotaGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest().user;
    const result = await this.billingClient.checkExecutionQuota(user.organizationId);
    if (!result.allowed) {
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        plan: result.plan,
        current: result.current,
        limit: result.limit,
      });
    }
    return true;
  }
}
```

Appliquer sur `POST /workflows/:id/execute` dans `workflow.controller.ts`.

Après exécution réussie, appeler `billingClient.incrementExecution(organizationId)` (fire-and-forget).

### 13. `services/agent-service/src/presentation/guards/agent-quota.guard.ts` *(nouveau)*

Même pattern — appliqué sur `POST /agents` (création).

À la suppression d'un agent : `billingClient.decrementAgentCount(organizationId)`.

### 14. `services/orchestration-service/src/infrastructure/external/billing-client.service.ts` *(nouveau)*

Client HTTP vers billing-service (interne, pas via gateway) :
```typescript
checkExecutionQuota(organizationId: string): Promise<QuotaCheckResult>
checkAgentQuota(organizationId: string): Promise<QuotaCheckResult>
incrementExecution(organizationId: string): Promise<void>
```

Même client à créer dans `agent-service`.

---

## Phase 4 — Frontend

### 15. `frontend/src/features/billing/` *(nouveau feature)*

```
billing/
  api/         billing.api.ts
  hooks/       useBilling.ts
  components/
    PricingTable.tsx         (page pricing publique)
    PlanBadge.tsx            (badge Free/Pro/... affiché partout)
    UsageBar.tsx             (barre de progression exec/agents)
    UpgradeModal.tsx         (affiché quand quota dépassé — code QUOTA_EXCEEDED)
    BillingSettingsPage.tsx  (plan actuel + boutons Upgrade/Portal)
    ServiceOrderForm.tsx     (formulaire services ponctuels)
```

### 16. `frontend/src/app/(public)/pricing/page.tsx` *(nouveau)*

Page publique `/pricing` avec :
- 4 cartes de plan (Free / Pro / Business / Enterprise)
- Toggle mensuel / annuel (prix dynamique)
- Bouton CTA par plan → Stripe Checkout pour les plans payants, formulaire contact pour Enterprise
- Section séparée pour les Services ponctuels avec les 3 types et leur fourchette de prix

### 17. `frontend/src/app/(app)/settings/billing/page.tsx` *(nouveau)*

Page protégée `/settings/billing` avec :
- Plan actuel + badge statut (ACTIVE / PAST_DUE / TRIALING)
- `UsageBar` : exécutions du mois (X / 5 000) + agents (X / 10)
- Date de prochain renouvellement
- Bouton "Gérer ma facturation" → Stripe Customer Portal
- Bouton "Changer de plan" → Pricing
- Section "Services ponctuels" → `ServiceOrderForm`

### 18. `frontend/src/features/billing/components/UpgradeModal.tsx`

Affiché automatiquement quand une API retourne `{ code: 'QUOTA_EXCEEDED' }` :
- Message contextuel ("Vous avez atteint la limite de X exécutions/mois sur le plan Free")
- Comparaison plan actuel vs plan suivant
- Bouton "Passer à Pro" → Stripe Checkout

Brancher dans le intercepteur Axios/fetch global pour ne pas gérer ça dans chaque composant.

### 19. `frontend/src/locales/en/billing.ts` et `frontend/src/locales/fr/billing.ts` *(nouveau)*

```typescript
// Clés principales
'billing.plans.free': 'Free',
'billing.plans.pro': 'Pro',
'billing.plans.business': 'Business',
'billing.plans.enterprise': 'Enterprise',
'billing.plans.monthly': 'Monthly',
'billing.plans.annual': 'Annual',
'billing.plans.perMonth': '/month',
'billing.plans.contact': 'Contact us',
'billing.plans.current': 'Current plan',
'billing.plans.upgrade': 'Upgrade',
'billing.quota.executions': 'Executions',
'billing.quota.agents': 'Agents',
'billing.quota.users': 'Users',
'billing.quota.exceeded': 'Quota exceeded',
'billing.quota.upgradePrompt': 'Upgrade your plan to continue',
'billing.portal.manage': 'Manage billing',
'billing.services.title': 'Punctual Services',
'billing.services.onboarding': 'Onboarding',
'billing.services.customWorkflow': 'Custom Workflow',
'billing.services.training': 'Training',
'billing.services.requestSent': 'Request sent — our team will contact you within 24h',
```

Enregistrer dans `src/locales/{en,fr}/index.ts`.

---

## Risques

| Risque | Mitigation |
|--------|-----------|
| Race condition sur l'incrémentation du compteur | Utiliser `increment` atomique Prisma (`{ executionCount: { increment: 1 } }`) |
| Webhook Stripe rejoué deux fois | Idempotence : vérifier que `stripeSubscriptionId` n'a pas déjà été traité avant de mettre à jour |
| Utilisateur contourne le quota guard en appelant directement un microservice | Guards aussi dans agent-service et orchestration-service (pas seulement au niveau gateway) |
| Plan Enterprise sur devis — pas automatisable | Flux manuel : formulaire → email commercial → activation manuelle par ADMIN via `PATCH /billing/organizations/:id/plan` |
| SSO Business non implémenté en v1 | Afficher "SSO - Bientôt disponible" dans l'UI, plan déjà en DB — implémenter séparément |
| Reset mensuel des compteurs | Pas de cron : clé `month = "YYYY-MM"`, nouvel `upsert` chaque mois crée automatiquement un nouveau record |

---

## Hors scope (v1)

- SSO (SAML/OIDC) pour Business/Enterprise
- Analytics avancées pour Business (dashboard dédié)
- Facturation à l'usage (pay-per-execution au-delà du quota)
- Multi-devises (EUR uniquement en v1)
- Gestion des membres d'organisation dans l'UI (invitation par email)
- Support on-premise pour Enterprise

---

## Séquence d'implémentation recommandée

```
1. Migration Prisma (Organization, UsageRecord, ServiceOrder, enums)
→ 2. PLAN_LIMITS entity (source de vérité partagée)
→ 3. billing-service (scaffold + PlanLimitsService + UsageTracker)
→ 4. StripeService + StripeWebhookController
→ 5. BillingController + ServiceOrderController
→ 6. Gateway : env var + proxy case 'billing'
→ 7. BillingClientService dans orchestration-service + ExecutionQuotaGuard
→ 8. BillingClientService dans agent-service + AgentQuotaGuard
→ 9. API frontend billing + hooks
→ 10. PricingTable (page publique)
→ 11. BillingSettingsPage + UsageBar
→ 12. UpgradeModal + intercepteur global
→ 13. ServiceOrderForm
→ 14. i18n EN + FR
→ 15. Tests
```

---

## Tests à écrire (TDD)

- `plan-limits.service.spec.ts` — FREE bloqué à 100 exec, ENTERPRISE jamais bloqué, `isUnlimited(-1)` retourne true
- `usage-tracker.service.spec.ts` — `increment` atomique, reset par changement de mois
- `stripe-webhook.controller.spec.ts` — rejet si signature invalide (403), idempotence sur event déjà traité
- `execution-quota.guard.spec.ts` — lève `ForbiddenException` avec `code: QUOTA_EXCEEDED` quand quota atteint, laisse passer si illimité
- `billing.controller.spec.ts` — `/billing/status` retourne plan + usage + date renouvellement
