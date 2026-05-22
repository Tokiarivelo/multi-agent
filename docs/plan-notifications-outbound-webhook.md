# Plan d'implémentation — Notifications email & Webhook sortant

## Objectif

1. **Notifications email** : notifier le propriétaire (et les collaborateurs opt-in) d'un workflow quand une exécution se termine (succès ou échec), via l'`email-mcp-service` existant.
2. **Webhook sortant** : à la fin d'une exécution, envoyer le résultat en `POST` vers une URL externe configurée par l'utilisateur (ex : Slack, n8n, Zapier, endpoint interne), avec une signature HMAC pour vérification.

---

## Contexte existant

| Existant | État |
|----------|------|
| `WorkflowNotificationService` | Envoie déjà des emails de collaboration via `email-mcp-service` — c'est le **pattern à suivre** |
| `Notification` model (Prisma) | Table générique (`type: String`, `payload: Json`) — utilisée pour les notifs in-app |
| `NotificationController` | Gère list/mark-read en base — pas d'envoi automatique |
| `workflow-executor.service.ts` | Marque les exécutions `COMPLETED`/`FAILED` mais **n'émet aucune notification** |
| `email-mcp-service` | Nodemailer SMTP + outil `email_send` — prêt à l'emploi |

**Point d'accroche** : les lignes ~244, ~315, ~422 de `workflow-executor.service.ts` où le statut `COMPLETED`/`FAILED` est écrit — c'est là qu'on appelle le dispatcher de notifications.

---

## Phase 1 — Database

### 1. `packages/database/prisma/schema.prisma`

**a) Préférences de notification par workflow (opt-in)**

```prisma
model WorkflowNotificationConfig {
  id             String   @id @default(uuid())
  workflowId     String
  userId         String
  onSuccess      Boolean  @default(true)
  onFailure      Boolean  @default(true)
  emailEnabled   Boolean  @default(true)
  inAppEnabled   Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  workflow       Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workflowId, userId])
  @@index([workflowId])
  @@map("workflow_notification_configs")
}
```

**b) Webhooks sortants configurés par workflow**

```prisma
model WorkflowOutboundWebhook {
  id          String   @id @default(uuid())
  workflowId  String
  userId      String
  url         String                    // URL cible
  secret      String                    // clé HMAC-SHA256 (stockée chiffrée en prod)
  onSuccess   Boolean  @default(true)
  onFailure   Boolean  @default(true)
  isActive    Boolean  @default(true)
  lastCalledAt  DateTime?
  lastStatus    Int?                    // code HTTP du dernier appel
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  workflow    Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([workflowId])
  @@index([isActive])
  @@map("workflow_outbound_webhooks")
}
```

Ajouter dans `Workflow` :
```prisma
notificationConfigs    WorkflowNotificationConfig[]
outboundWebhooks       WorkflowOutboundWebhook[]
```

Migration : `pnpm prisma:migrate` — nom : `add_workflow_notifications_and_outbound_webhooks`

---

## Phase 2 — Service de dispatch (orchestration-service)

### 2. `services/orchestration-service/src/domain/services/execution-notification.service.ts` *(nouveau)*

Service injecté dans le workflow executor. Appelé à la fin de chaque exécution.

```typescript
interface ExecutionResult {
  executionId: string;
  workflowId: string;
  userId: string;       // propriétaire du workflow
  status: 'COMPLETED' | 'FAILED';
  durationMs: number;
  errorMessage?: string;
  outputSummary?: Record<string, unknown>;
}

@Injectable()
export class ExecutionNotificationService {
  async dispatch(result: ExecutionResult): Promise<void> {
    // 1. Charger les NotificationConfigs actives pour ce workflow
    // 2. Pour chaque config : envoyer email si emailEnabled + créer Notification in-app
    // 3. Charger les OutboundWebhooks actifs pour ce workflow
    // 4. Pour chaque webhook : appeler OutboundWebhookDispatcher
  }
}
```

Règle : réponse **fire-and-forget** avec `catch` loggé — ne jamais bloquer l'exécution principale.

### 3. `services/orchestration-service/src/domain/services/outbound-webhook-dispatcher.service.ts` *(nouveau)*

```typescript
@Injectable()
export class OutboundWebhookDispatcher {
  async send(webhook: WorkflowOutboundWebhook, payload: WebhookPayload): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = this.sign(webhook.secret, body);     // HMAC-SHA256

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-256': `sha256=${signature}`,
        'X-Workflow-Id': webhook.workflowId,
      },
      body,
      signal: AbortSignal.timeout(10_000),                 // timeout 10s
    });

    await this.prisma.workflowOutboundWebhook.update({
      where: { id: webhook.id },
      data: { lastCalledAt: new Date(), lastStatus: response.status },
    });
  }

  private sign(secret: string, body: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }
}
```

**Format du payload envoyé :**
```json
{
  "event": "workflow.execution.completed",
  "workflowId": "uuid",
  "executionId": "uuid",
  "status": "COMPLETED",
  "triggeredAt": "2026-05-22T09:00:00Z",
  "durationMs": 3241,
  "output": { /* dernières variables du contexte */ }
}
```

Pour un échec : `"event": "workflow.execution.failed"` + champ `"error": "message"`.

### 4. `services/orchestration-service/src/infrastructure/external/workflow-executor.service.ts`

**Modification minimale** — injecter `ExecutionNotificationService` et l'appeler aux 3 points de fin :

```typescript
// Après chaque update de statut final (COMPLETED ou FAILED)
this.notificationService.dispatch({
  executionId: execution.id,
  workflowId,
  userId: execution.userId,
  status: finalStatus,
  durationMs: Date.now() - startTime,
  errorMessage,
  outputSummary,
}).catch((err) => this.logger.error(`Notification dispatch failed: ${err}`));
```

Ne pas mettre de logique notification dans ce fichier — uniquement l'appel.

### 5. `services/orchestration-service/src/domain/services/execution-email-builder.service.ts` *(nouveau)*

Construit le HTML des emails de fin d'exécution (extrait de `ExecutionNotificationService` pour respecter la limite 300 lignes).

Templates :
- **Succès** : durée, lien vers les logs, résumé output
- **Échec** : message d'erreur, lien vers les logs, bouton "Relancer"

### 6. `services/orchestration-service/src/presentation/controllers/outbound-webhook.controller.ts` *(nouveau)*

Endpoints authentifiés pour gérer les webhooks sortants d'un workflow :

| Méthode | Route | Action |
|---------|-------|--------|
| `GET` | `/:workflowId` | Lister les webhooks configurés |
| `POST` | `/:workflowId` | Créer un webhook sortant |
| `PATCH` | `/:id/toggle` | Activer / désactiver |
| `DELETE` | `/:id` | Supprimer |
| `POST` | `/:id/test` | Envoyer un payload de test |

### 7. `services/orchestration-service/src/presentation/controllers/notification-config.controller.ts` *(nouveau)*

Endpoints authentifiés pour les préférences de notification :

| Méthode | Route | Action |
|---------|-------|--------|
| `GET` | `/:workflowId` | Lire les préférences |
| `PUT` | `/:workflowId` | Créer ou mettre à jour les préférences |

### 8. `services/orchestration-service/src/app.module.ts`

Enregistrer les 4 nouveaux services + 2 nouveaux contrôleurs.

---

## Phase 3 — Gateway

### 9. `services/gateway-service/src/presentation/controllers/proxy.controller.ts`

Ajouter dans le switch :
```typescript
case 'outbound-webhooks':     // → ORCHESTRATION_SERVICE_URL
case 'notification-configs':  // → ORCHESTRATION_SERVICE_URL
  break;
```

Pas de nouvel env var — tout passe par `ORCHESTRATION_SERVICE_URL` existant.

---

## Phase 4 — Frontend

### 10. `frontend/src/features/workflows/api/workflows.api.ts`

Ajouter :
- `getNotificationConfig(workflowId)`
- `updateNotificationConfig(workflowId, dto)`
- `getOutboundWebhooks(workflowId)`
- `createOutboundWebhook(dto)`
- `toggleOutboundWebhook(id)`
- `deleteOutboundWebhook(id)`
- `testOutboundWebhook(id)`

### 11. `frontend/src/features/workflows/hooks/useWorkflows.ts`

Ajouter les hooks React Query correspondants (8 hooks).

### 12. `frontend/src/features/workflows/components/WorkflowTriggersPanel.tsx`

Ajouter deux sections dans le panneau existant :

**Section "Notifications email"** (extraire `NotificationConfigCard`) :
- Toggle "Notifier en cas de succès"
- Toggle "Notifier en cas d'échec"
- Toggle "Activer par email" / "Notif in-app"

**Section "Webhooks sortants"** (extraire `OutboundWebhookCard`, `OutboundWebhookForm`) :
- Formulaire : URL + champ secret (masqué) + cases à cocher succès/échec
- Liste des webhooks configurés avec : URL tronquée, statut dernier appel (code HTTP + date), toggle actif, bouton test, bouton supprimer
- Badge vert/rouge selon `lastStatus`

### 13. `frontend/src/features/workflows/components/NotificationConfigCard.tsx` *(nouveau)*

Composant extrait — toggles de préférences + label explicatif. Max 100 lignes.

### 14. `frontend/src/features/workflows/components/OutboundWebhookCard.tsx` *(nouveau)*

Carte pour un webhook sortant configuré. Max 100 lignes.

### 15. `frontend/src/locales/en/workflows.ts` et `frontend/src/locales/fr/workflows.ts`

```typescript
// Notifications email
'workflows.notifConfig.title': 'Email Notifications',
'workflows.notifConfig.onSuccess': 'Notify on success',
'workflows.notifConfig.onFailure': 'Notify on failure',
'workflows.notifConfig.emailEnabled': 'Send by email',
'workflows.notifConfig.inAppEnabled': 'In-app notification',

// Webhooks sortants
'workflows.outboundWebhook.title': 'Outgoing Webhooks',
'workflows.outboundWebhook.add': 'Add webhook',
'workflows.outboundWebhook.url': 'Target URL',
'workflows.outboundWebhook.secret': 'Signing secret (HMAC)',
'workflows.outboundWebhook.onSuccess': 'Fire on success',
'workflows.outboundWebhook.onFailure': 'Fire on failure',
'workflows.outboundWebhook.lastCall': 'Last call',
'workflows.outboundWebhook.test': 'Send test',
'workflows.outboundWebhook.testSent': 'Test payload sent',
'workflows.outboundWebhook.noWebhooks': 'No webhooks configured',
```

---

## Risques

| Risque | Mitigation |
|--------|-----------|
| Email non livré bloque l'exécution | Toujours fire-and-forget avec `catch` loggé — jamais `await` bloquant |
| Webhook sortant vers URL lente ou morte | Timeout 10 s + pas de retry en v1 (documenter) |
| Secret HMAC stocké en clair en DB | Chiffrer avec `AES-256-GCM` via un `WEBHOOK_SECRET_KEY` env var avant insertion |
| Boucle infinie si le webhook cible déclenche lui-même un workflow | Ajouter header `X-Source: multi-agent-platform` et ignorer les appels qui en portent |
| Flooding email si workflow tourne 100×/jour | Ajouter throttle : max 1 email de notification par workflow par heure |

---

## Hors scope (v1)

- Retry automatique avec backoff exponentiel sur les webhooks sortants
- Digest quotidien (résumé de toutes les exécutions de la journée)
- Notifications SMS / push mobile
- Filtres conditionnels (notifier seulement si output contient une valeur donnée)
- Historique complet des livraisons de webhooks (logs de chaque tentative)

---

## Séquence d'implémentation recommandée

```
1. Migration Prisma
→ 2. OutboundWebhookDispatcher (le plus isolé — aucune dépendance circulaire)
→ 3. ExecutionEmailBuilder
→ 4. ExecutionNotificationService (assemble 2 + 3)
→ 5. Modifier workflow-executor.service.ts (point d'accroche)
→ 6. NotificationConfigController + OutboundWebhookController
→ 7. app.module.ts
→ 8. Gateway proxy cases
→ 9. API frontend + hooks
→ 10. UI WorkflowTriggersPanel (NotificationConfigCard + OutboundWebhookCard)
→ 11. i18n
→ 12. Tests
```

---

## Tests à écrire (TDD)

- `outbound-webhook-dispatcher.service.spec.ts` — signature HMAC correcte, timeout 10 s déclenche catch, `lastStatus` mis à jour
- `execution-notification.service.spec.ts` — dispatch appelle l'email builder si `emailEnabled`, skip si `onSuccess = false` pour exécution réussie
- `notification-config.controller.spec.ts` — PUT crée si absent, met à jour si existe (`upsert`)
- `outbound-webhook.controller.spec.ts` — POST `/test` envoie un payload avec `"event": "workflow.test"`, 404 si webhook n'appartient pas à l'userId
