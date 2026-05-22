# Plan d'implémentation — Webhook Trigger (endpoint + sous-domaine)

## Objectif

Chaque workflow actif peut exposer une URL unique et publique (ex: `hooks.yourdomain.com/wh/<token>`) que n'importe quel système externe peut appeler en `POST` pour déclencher le workflow, avec les données du body passées comme contexte d'entrée.

---

## Contexte existant

- Le pattern Gmail webhook (`GmailWebhookController`, `GmailTriggerService`) est la référence : endpoint `@Public()`, traitement asynchrone, réponse immédiate 202.
- Le gateway a déjà une route `@Public() @All('workflows/webhook/*')` non protégée par JWT — elle peut être réutilisée ou complétée.
- L'ingress K8s a déjà le squelette pour un sous-domaine (`api.multi-agent.local`) — on ajoute `hooks.`.
- L'entité `Workflow` n'a pas de champ `webhookToken` — il faut l'ajouter.

---

## Architecture cible

```
POST https://hooks.yourdomain.com/wh/<token>
         │
         ▼
  [Nginx Ingress]  (host: hooks.yourdomain.com)
         │
         ▼
  [gateway-service]  WebhookInboundController (public, no JWT)
         │  lookup token → workflowId
         │  valide workflow actif
         │  répond 202 immédiatement
         │
         ▼
  [orchestration-service]  ExecuteWorkflowUseCase
         │  body HTTP → inputContext du workflow
         ▼
  [execution pipeline existant]
```

---

## Phase 1 — Database

### 1. `packages/database/prisma/schema.prisma`

Ajouter `webhookToken` dans `Workflow` :

```prisma
model Workflow {
  // ... champs existants ...
  webhookToken  String?  @unique   // UUID généré à la création si activé
  webhookActive Boolean  @default(false)

  @@index([webhookToken])
}
```

Ajouter la table de logs des appels entrants :

```prisma
model WebhookCall {
  id           String   @id @default(uuid())
  workflowId   String
  executionId  String?              // null si le workflow a rejeté l'appel
  sourceIp     String?
  method       String
  headers      Json
  body         Json
  statusCode   Int
  triggeredAt  DateTime @default(now())
  workflow     Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@index([workflowId])
  @@index([triggeredAt])
  @@map("webhook_calls")
}
```

Ajouter `webhookCalls WebhookCall[]` dans `Workflow`.

Migration : `pnpm prisma:migrate` — nom : `add_workflow_webhook`

---

## Phase 2 — Backend orchestration-service

### 2. `services/orchestration-service/src/domain/services/webhook-trigger.service.ts` *(nouveau)*

Logique métier :
- `generateToken(workflowId)` — génère un UUID v4, le stocke dans `webhookToken`, active `webhookActive`
- `revokeToken(workflowId)` — met `webhookToken = null`, `webhookActive = false`
- `findByToken(token)` — retourne le workflow si token valide + actif
- `logCall(dto)` — insère un `WebhookCall`

### 3. `services/orchestration-service/src/application/dto/webhook-trigger.dto.ts` *(nouveau)*

```typescript
export class WebhookInboundDto {
  @IsOptional() @IsObject() body?: Record<string, unknown>;
}

export class EnableWebhookResponseDto {
  token: string;
  url: string;       // URL publique complète
  workflowId: string;
}
```

### 4. `services/orchestration-service/src/presentation/controllers/webhook-trigger.controller.ts` *(nouveau)*

Endpoints REST sous `/api/orchestration/webhooks/...` (authentifiés, pour gérer ses tokens) :

| Méthode | Route | Action |
|---------|-------|--------|
| `POST` | `/:workflowId/enable` | Génère/renouvelle le token webhook |
| `DELETE` | `/:workflowId/disable` | Révoque le token |
| `GET` | `/:workflowId` | Retourne le token et l'URL publique |
| `GET` | `/:workflowId/calls` | Historique des appels (paginé) |

### 5. `services/orchestration-service/src/presentation/controllers/webhook-inbound.controller.ts` *(nouveau)*

Endpoint **public** (pas de JWT) qui reçoit les appels externes :

```typescript
@Public()
@Controller('inbound/wh')
export class WebhookInboundController {
  @Post(':token')
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(
    @Param('token') token: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ executionId: string }> {
    // 1. Résoudre le workflow depuis le token
    // 2. Valider que le workflow est ACTIVE
    // 3. Logger l'appel entrant
    // 4. Déclencher ExecuteWorkflowUseCase en fire-and-forget
    // 5. Répondre 202 { executionId } immédiatement
  }
}
```

**Règles de sécurité à implémenter dans ce contrôleur :**
- Rate limit : 60 req/min par token (via `@nestjs/throttler`)
- Body size max : 1 MB (configuré au niveau gateway)
- Si workflow INACTIVE → 404 (ne pas révéler l'existence du token)
- Headers entrants loggés sauf `Authorization`

---

## Phase 3 — Gateway (sous-domaine `hooks.`)

### 6. `services/gateway-service/src/presentation/controllers/webhook-inbound-proxy.controller.ts` *(nouveau)*

Contrôleur dédié au sous-domaine `hooks.` — **sans JWT, sans `@Public()` global** car il détecte le sous-domaine :

```typescript
@Controller()
export class WebhookInboundProxyController {
  @All('wh/:token')
  async proxyWebhook(@Req() req, @Res() res, @Param('token') token: string) {
    // Proxy transparent vers orchestration-service /inbound/wh/:token
    // Ajoute X-Forwarded-For pour logging IP
  }
}
```

Alternativement (plus simple) : étendre la route `@All('workflows/webhook/*')` **existante** dans `proxy.controller.ts` pour matcher `/inbound/wh/:token` → orchestration-service.

**Recommandé — approche simple** : ajouter dans le switch existant :
```typescript
case 'inbound':  // /api/inbound/wh/:token → orchestration-service
  break;
```
Et dans la route `@Public() @All('inbound/wh/:token')` — pas de nouveau contrôleur.

### 7. `services/gateway-service/src/infrastructure/config/env.validation.ts`

Aucun ajout — `ORCHESTRATION_SERVICE_URL` est déjà présent.

---

## Phase 4 — Ingress Kubernetes (sous-domaine)

### 8. `k8s/ingress.yaml`

Ajouter une règle pour `hooks.yourdomain.com` :

```yaml
- host: hooks.yourdomain.com
  http:
    paths:
      - path: /wh/
        pathType: Prefix
        backend:
          service:
            name: gateway-service
            port:
              number: 3000
```

Le gateway recevra les requêtes sous `/wh/<token>` et les re-mappe vers `/api/inbound/wh/<token>` dans orchestration-service.

**TLS** : activer cert-manager avec `letsencrypt-prod` sur ce host (wildcard `*.yourdomain.com` ou cert dédié `hooks.yourdomain.com`).

---

## Phase 5 — Frontend

### 9. `frontend/src/features/workflows/api/workflows.api.ts`

Ajouter :
- `enableWebhook(workflowId)` → POST `/api/orchestration/webhooks/:workflowId/enable`
- `disableWebhook(workflowId)` → DELETE `/api/orchestration/webhooks/:workflowId/disable`
- `getWebhookInfo(workflowId)` → GET `/api/orchestration/webhooks/:workflowId`
- `getWebhookCalls(workflowId, page)` → GET `/api/orchestration/webhooks/:workflowId/calls`

### 10. `frontend/src/features/workflows/hooks/useWorkflows.ts`

Ajouter :
- `useWebhookInfo(workflowId)`
- `useEnableWebhook()`
- `useDisableWebhook()`
- `useWebhookCalls(workflowId)`

### 11. `frontend/src/features/workflows/components/WorkflowTriggersPanel.tsx`

Ajouter section **"Webhook entrant"** :
- Toggle "Activer le webhook"
- À l'activation : afficher l'URL publique avec bouton copier
- Bouton "Révoquer et régénérer le token"
- Tableau des derniers appels (date, IP source, status code, executionId cliquable)

Extraire `WebhookTriggerCard` si > 150 lignes.

### 12. `frontend/src/locales/en/workflows.ts` et `frontend/src/locales/fr/workflows.ts`

```typescript
// Clés à ajouter
'workflows.webhook.title': 'Incoming Webhook',
'workflows.webhook.enable': 'Enable webhook',
'workflows.webhook.disable': 'Disable webhook',
'workflows.webhook.url': 'Webhook URL',
'workflows.webhook.copy': 'Copy URL',
'workflows.webhook.copied': 'Copied!',
'workflows.webhook.regenerate': 'Revoke and regenerate',
'workflows.webhook.calls': 'Recent calls',
'workflows.webhook.noCallsYet': 'No calls received yet',
'workflows.webhook.warningRegenerate': 'This will invalidate the current URL. Are you sure?',
```

---

## Risques

| Risque | Mitigation |
|--------|-----------|
| Abus / DDoS sur l'endpoint public | Rate limit 60 req/min par token + 1000 req/min global via throttler |
| Énumération de tokens | Toujours répondre 404 si token inconnu OU workflow inactif (pas de différence) |
| Body malveillant / trop lourd | Body size max 1 MB dans gateway (`proxy-body-size: 1m` sur la route inbound) |
| Exécutions fantômes si workflow modifié | Vérifier `status === ACTIVE` au moment du hit, pas à la génération du token |
| Secrets dans les headers loggés | Filtrer les headers `Authorization`, `Cookie`, `X-Api-Key` avant insertion en DB |

---

## Hors scope (v1)

- Signature HMAC des payloads entrants (webhook secret partagé)
- Retry automatique depuis la plateforme vers l'appelant
- Filtres conditionnels sur le body (déclencher seulement si `body.event === 'payment.success'`)
- Webhook sortant (notifier un endpoint externe à la fin d'un workflow)

---

## Séquence d'implémentation recommandée

```
1. Migration Prisma → 2. WebhookTriggerService → 3. WebhookInboundController
→ 4. WebhookManagementController → 5. Gateway route /api/inbound → 6. Ingress hooks.*
→ 7. API frontend → 8. Hooks → 9. UI WorkflowTriggersPanel → 10. i18n → 11. Tests
```

---

## Tests à écrire (TDD)

- `webhook-trigger.service.spec.ts` — `findByToken` retourne null si inactif, `generateToken` génère un UUID unique
- `webhook-inbound.controller.spec.ts` — 202 sur token valide, 404 sur token inconnu, 404 si workflow INACTIVE
- `webhook-inbound.controller.spec.ts` — rate limit : 61e requête retourne 429
- `webhook-trigger.controller.spec.ts` — seul le propriétaire peut activer/désactiver son webhook (guard userId)

---

## Exemple d'appel externe (une fois implémenté)

```bash
curl -X POST https://hooks.yourdomain.com/wh/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "orderId": "ORD-123", "amount": 4990}'

# Réponse :
# HTTP 202
# { "executionId": "exec_8fa2c1..." }
```
