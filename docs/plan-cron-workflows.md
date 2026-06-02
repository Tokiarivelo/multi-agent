# Plan d'implémentation — Planification temporelle (Cron Workflows)

## Objectif

Permettre aux utilisateurs de déclencher automatiquement un workflow à intervalle régulier via une expression cron (ex: `0 9 * * 1` = chaque lundi à 9h), sans intervention manuelle.

---

## Contexte existant

- Le système de triggers Gmail (`GmailTriggerService`, `GmailWatchSubscription`) montre le pattern déjà établi : une table de subscriptions + un service domain + un contrôleur dédié + un panneau UI (`WorkflowTriggersPanel`).
- Le `WorkflowTriggersPanel` est déjà le point d'entrée UI pour les triggers — on l'étend.
- `@nestjs/schedule` n'est pas encore installé dans `orchestration-service`.
- Le modèle Prisma `Workflow` n'a pas de champ `schedules` — il faut une nouvelle table.

---

## Phase 1 — Backend (orchestration-service + database)

### 1. `packages/database/prisma/schema.prisma`
Ajouter le modèle `WorkflowSchedule` :

```prisma
model WorkflowSchedule {
  id          String   @id @default(uuid())
  workflowId  String
  userId      String
  cronExpr    String                          // ex: "0 9 * * 1"
  timezone    String   @default("UTC")
  isActive    Boolean  @default(true)
  lastRunAt   DateTime?
  nextRunAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  workflow    Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([workflowId])
  @@index([isActive])
  @@map("workflow_schedules")
}
```

Ajouter la relation dans `Workflow` :
```prisma
schedules WorkflowSchedule[]
```

Ajouter la relation dans `User` :
```prisma
workflowSchedules WorkflowSchedule[]
```

Puis : `pnpm prisma:migrate` (nom de migration : `add_workflow_schedules`)

---

### 2. `services/orchestration-service/src/domain/entities/workflow-schedule.entity.ts` *(nouveau)*
Entité domain `WorkflowSchedule` avec méthode `isValidCron(): boolean`.

---

### 3. `services/orchestration-service/src/domain/services/workflow-schedule.service.ts` *(nouveau)*
Service domain — CRUD des schedules :
- `create(dto)` — valide l'expression cron avant insertion
- `findByWorkflow(workflowId)`
- `activate(id)` / `deactivate(id)`
- `delete(id)`
- `findAllActive()` — utilisé par le scheduler

---

### 4. `services/orchestration-service/src/domain/services/cron-runner.service.ts` *(nouveau)*
Service NestJS schedulé (`@nestjs/schedule`) :
- Méthode `@Cron(CronExpression.EVERY_MINUTE)` qui :
  1. Récupère tous les schedules actifs dont `nextRunAt <= now()`
  2. Pour chacun, appelle `execute-workflow` use-case
  3. Met à jour `lastRunAt` et calcule `nextRunAt` via `cron-parser`

**Dépendances à installer :**
```bash
pnpm --filter orchestration-service add @nestjs/schedule cron-parser
pnpm --filter orchestration-service add -D @types/cron
```

---

### 5. `services/orchestration-service/src/application/dto/create-schedule.dto.ts` *(nouveau)*
```typescript
export class CreateScheduleDto {
  @IsString() @IsNotEmpty() workflowId: string;
  @IsString() @Matches(/^(\*|[0-9,\-\/]+)\s+.../) cronExpr: string;
  @IsString() @IsOptional() timezone?: string;
}
```

---

### 6. `services/orchestration-service/src/presentation/controllers/workflow-schedule.controller.ts` *(nouveau)*
Endpoints REST sous `/api/orchestration/schedules/...` :

| Méthode | Route | Action |
|---------|-------|--------|
| `GET` | `/:workflowId` | Lister les schedules d'un workflow |
| `POST` | `/` | Créer un schedule |
| `PATCH` | `/:id/toggle` | Activer / désactiver |
| `DELETE` | `/:id` | Supprimer |

---

### 7. `services/orchestration-service/src/app.module.ts`
- Importer `ScheduleModule.forRoot()` (de `@nestjs/schedule`)
- Enregistrer `WorkflowScheduleService` et `CronRunnerService`

---

### 8. `services/gateway-service/src/presentation/controllers/proxy.controller.ts`
Ajouter le cas `'schedules'` dans le switch du proxy (route → `ORCHESTRATION_SERVICE_URL`). Les schedules passent par le même service orchestration — pas de nouvel env var.

---

## Phase 2 — Frontend

### 9. `frontend/src/features/workflows/api/workflows.api.ts`
Ajouter les fonctions API :
- `getWorkflowSchedules(workflowId)`
- `createWorkflowSchedule(dto)`
- `toggleWorkflowSchedule(id, isActive)`
- `deleteWorkflowSchedule(id)`

---

### 10. `frontend/src/features/workflows/hooks/useWorkflows.ts`
Ajouter les hooks React Query :
- `useWorkflowSchedules(workflowId)`
- `useCreateSchedule()`
- `useToggleSchedule()`
- `useDeleteSchedule()`

---

### 11. `frontend/src/features/workflows/components/WorkflowTriggersPanel.tsx`
Étendre le panneau existant avec une section **"Déclencheurs planifiés"** :
- Input pour l'expression cron (avec aide visuelle : `0 9 * * 1`)
- Select pour le fuseau horaire
- Liste des schedules actifs avec badge statut + prochain run calculé
- Bouton toggle (activer/désactiver) + bouton supprimer

**Max 150 lignes** — extraire `CronScheduleCard` et `CronScheduleForm` en sous-composants si nécessaire.

---

### 12. `frontend/src/locales/en/workflows.ts` et `frontend/src/locales/fr/workflows.ts`
Ajouter toutes les clés i18n pour la fonctionnalité :

```typescript
// Clés à ajouter (exemple)
'workflows.schedules.title': 'Scheduled Triggers',
'workflows.schedules.addCron': 'Add cron schedule',
'workflows.schedules.cronExpr': 'Cron expression',
'workflows.schedules.timezone': 'Timezone',
'workflows.schedules.nextRun': 'Next run',
'workflows.schedules.lastRun': 'Last run',
'workflows.schedules.active': 'Active',
'workflows.schedules.inactive': 'Inactive',
'workflows.schedules.invalidCron': 'Invalid cron expression',
```

---

## Risques

| Risque | Mitigation |
|--------|-----------|
| Expressions cron invalides crashent le runner | Valider avec `cron-parser` au moment du `create`, refuser les invalides |
| Fuseaux horaires mal gérés | Utiliser la lib `luxon` ou `date-fns-tz` déjà en place ; stocker `timezone` en string IANA |
| Double exécution si plusieurs pods | Ajouter `@@unique([workflowId, cronExpr])` ou un lock optimiste sur `nextRunAt` |
| Drift du runner minute-par-minute | Acceptable pour v1 — documenter la précision ±1 min |

---

## Hors scope (v1)

- Interface visuelle de construction cron (cron-builder UI)
- Historique des exécutions planifiées séparé
- Notifications en cas d'échec du trigger planifié
- Rate limiting par plan Pro/Free

---

## Séquence d'implémentation recommandée

```
1. Migration Prisma → 2. Entité domain → 3. WorkflowScheduleService
→ 4. CronRunnerService → 5. DTO + Controller → 6. app.module.ts
→ 7. Gateway proxy → 8. API frontend → 9. Hooks → 10. UI + i18n → 11. Tests
```

---

## Tests à écrire (TDD)

- `workflow-schedule.service.spec.ts` — `create` rejette un cron invalide, `findAllActive` retourne seulement `isActive: true`
- `cron-runner.service.spec.ts` — déclenche les workflows dont `nextRunAt <= now()`, met à jour `lastRunAt`
- `workflow-schedule.controller.spec.ts` — 201 à la création, 400 sur cron invalide
