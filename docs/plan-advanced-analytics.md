# Plan d'implémentation — Advanced Analytics Dashboard

## Objectif

Passer de l'analytics basique actuel (tokens par modèle) à un tableau de bord analytique complet couvrant : coûts réels en €, performance des workflows (succès/durée/P95), classement des agents, comparaison des modèles, analytics multi-utilisateurs (BUSINESS/ENTERPRISE) et exports PDF/CSV. Réservé aux plans BUSINESS et ENTERPRISE.

---

## Contexte existant

| Ce qui existe | Limite |
|---------------|--------|
| `TokenUsageChart` — tokens par modèle (recharts AreaChart) | Tokens bruts seulement, pas de coût |
| `TokenUsageTable` — liste paginée des usages | Pas de filtres avancés, pas d'agrégats |
| `DashboardStats` — 4 compteurs (workflows, agents, exécutions) | Pas de tendance, pas de période |
| `token_usage` table avec `inputCostPer1kTokens` sur `Model` | Coût jamais calculé dans les queries |
| `WorkflowExecution`, `Execution`, `ExecutionLog` | Durées non exploitées |
| `agent-service` → `/api/agents/token-usage` | Données agents seulement, silo |

**Bibliothèque charts : `recharts ^3.8.1` déjà installée** — pas de nouvelle dépendance.

**Feature gate** : `analytics: true` uniquement sur les plans BUSINESS et ENTERPRISE (`plan-subscriptions.md`).

---

## Ports réservés

| Service            | Port |
|--------------------|------|
| analytics-service  | 3018 |

---

## Métriques cibles

### KPI summary (en-tête de page)
| Métrique | Source | Granularité |
|----------|--------|-------------|
| Coût total période (€) | `token_usage × model.costPer1k` | période sélectionnée |
| Δ coût vs période précédente | calcul analytics-service | % ± |
| Taux de succès des exécutions | `workflow_executions.status` | période |
| Temps médian d'exécution (P50) | `completedAt - startedAt` | période |
| Exécutions par jour (moyenne) | `workflow_executions` | période |
| Agent le plus coûteux | `token_usage GROUP BY agentId` | période |

### Vues graphiques
| Vue | Type de chart | Données |
|-----|---------------|---------|
| Coût dans le temps | AreaChart (recharts existant) | € par jour/semaine/mois par modèle |
| Volume d'exécutions + taux de succès | ComposedChart (Bar + Line) | nb exéc. (bar) + % succès (line) |
| Répartition coût par modèle | PieChart / RadialBar | % coût par modèle LLM |
| Performance des workflows | DataTable triable | success%, avg durée, coût, volume |
| Classement des agents | HorizontalBarChart | coût total et nb appels par agent |
| Heatmap d'activité | Calendar heatmap SVG | exécutions par heure × jour de semaine |
| Durée P50/P95 dans le temps | LineChart multi-series | évolution latence par workflow |
| Comparaison période (sparklines) | Sparkline cards | courant vs N-1 période |

---

## Architecture cible

```
[analytics-service :3018]
  ├── GET /analytics/summary          → KPI cards (coût, succès, P50)
  ├── GET /analytics/cost/timeseries  → coût × temps × modèle
  ├── GET /analytics/executions       → volume + taux succès dans le temps
  ├── GET /analytics/workflows        → performance par workflow
  ├── GET /analytics/agents           → classement agents
  ├── GET /analytics/models           → répartition coût par modèle
  ├── GET /analytics/heatmap          → activité hebdomadaire
  ├── GET /analytics/team             → breakdown par utilisateur (Enterprise)
  └── POST /analytics/export          → export CSV ou PDF

[gateway-service :3000]
  └── /api/analytics/* → proxy → analytics-service
  └── AnalyticsFeatureGuard : bloque si plan FREE ou PRO

[Frontend]
  └── /analytics → page avancée (remplace la page actuelle)
      ├── AnalyticsSummary      (KPI cards)
      ├── CostTimeseriesChart
      ├── ExecutionVolumeChart
      ├── ModelBreakdownChart
      ├── WorkflowPerformanceTable
      ├── AgentLeaderboard
      ├── ActivityHeatmap
      └── TeamAnalyticsTable    (ENTERPRISE seulement)
```

---

## Phase 1 — Base de données (vues PostgreSQL)

### 1. `packages/database/prisma/schema.prisma` — vue matérialisée

Pas de nouveaux modèles Prisma. Utiliser des **vues PostgreSQL** créées via migration SQL brute pour éviter les full-table scans répétés :

```sql
-- Migration : create_analytics_views.sql

-- Vue 1 : coût calculé par token_usage
CREATE OR REPLACE VIEW v_token_cost AS
SELECT
  tu.id,
  tu."userId",
  tu."agentId",
  tu."workflowId",
  tu."timestamp",
  tu.model,
  tu."isTest",
  tu."inputTokens",
  tu."outputTokens",
  tu."totalTokens",
  tu.success,
  ROUND(
    (tu."inputTokens"  / 1000.0 * COALESCE(m."inputCostPer1kTokens", 0) +
     tu."outputTokens" / 1000.0 * COALESCE(m."outputCostPer1kTokens", 0))::numeric, 6
  ) AS cost_eur
FROM token_usage tu
LEFT JOIN models m ON m."modelName" = tu.model;

-- Vue 2 : durées d'exécution dénormalisées
CREATE OR REPLACE VIEW v_execution_duration AS
SELECT
  we.id,
  we."userId",
  we."workflowId",
  we.status,
  we."startedAt",
  we."completedAt",
  EXTRACT(EPOCH FROM (we."completedAt" - we."startedAt")) * 1000 AS duration_ms
FROM workflow_executions we
WHERE we."startedAt" IS NOT NULL AND we."completedAt" IS NOT NULL;

-- Index sur timestamp pour les range queries analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_token_usage_timestamp_userid
  ON token_usage("timestamp", "userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_started_userid
  ON workflow_executions("startedAt", "userId");
```

> Exécuter via `pnpm prisma migrate dev --name create_analytics_views`  
> avec le SQL brut dans `packages/database/prisma/migrations/<ts>_create_analytics_views/migration.sql`

---

## Phase 2 — analytics-service (nouveau microservice)

> Scaffolder avec `/create-service analytics 3018 "Agrégation analytics multi-sources — coût, performance, team"`

### 2. Structure

```
services/analytics-service/src/
├── domain/
│   └── services/
│       ├── cost.service.ts              # calcul coût depuis v_token_cost
│       ├── execution-stats.service.ts   # taux succès, durées P50/P95
│       ├── workflow-perf.service.ts     # agrégat par workflowId
│       ├── agent-stats.service.ts       # classement agents
│       ├── team-stats.service.ts        # breakdown userId (Enterprise)
│       └── heatmap.service.ts           # exécutions par heure/jour
├── application/
│   ├── use-cases/
│   │   ├── get-summary.use-case.ts
│   │   ├── get-cost-timeseries.use-case.ts
│   │   ├── get-execution-volume.use-case.ts
│   │   ├── get-workflow-performance.use-case.ts
│   │   ├── get-agent-leaderboard.use-case.ts
│   │   ├── get-model-breakdown.use-case.ts
│   │   ├── get-activity-heatmap.use-case.ts
│   │   ├── get-team-analytics.use-case.ts
│   │   └── export-analytics.use-case.ts
│   └── dto/
│       ├── analytics-filters.dto.ts     # période, userId, orgId, workflowId
│       └── export-request.dto.ts
├── infrastructure/
│   ├── database/analytics.repository.ts  # raw SQL via Prisma.$queryRaw
│   └── export/
│       ├── csv-report.service.ts
│       └── pdf-report.service.ts         # pdfmake (à ajouter)
└── presentation/
    ├── controllers/
    │   ├── analytics.controller.ts
    │   └── export.controller.ts
    └── guards/analytics-plan.guard.ts    # vérifie planContext.analytics === true
```

### 3. `application/dto/analytics-filters.dto.ts`

```typescript
const AnalyticsFiltersSchema = z.object({
  userId: z.string().uuid(),
  orgId: z.string().uuid().optional(),
  from: z.string().datetime(),            // ISO 8601
  to: z.string().datetime(),
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  workflowId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  model: z.string().optional(),
  excludeTests: z.boolean().default(true),
  compareWithPrevious: z.boolean().default(false), // active la période N-1
})
```

### 4. `domain/services/cost.service.ts`

```typescript
// getCostTimeseries(filters): { date, model, costEur, tokens }[]
//   → SELECT DATE_TRUNC(period, timestamp), model, SUM(cost_eur), SUM(totalTokens)
//     FROM v_token_cost WHERE userId = ? AND timestamp BETWEEN ? AND ?
//     GROUP BY 1, 2 ORDER BY 1

// getCostSummary(filters): { total, delta, topModel, topAgent }
//   → Deux requêtes parallèles (période courante + période précédente)
//   → delta = (current - previous) / previous * 100
```

### 5. `domain/services/execution-stats.service.ts`

```typescript
// getVolumeSeries(filters): { date, total, succeeded, failed, successRate }[]
// getPercentiles(filters): { p50: number; p95: number; p99: number }
//   → SELECT PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)
//     FROM v_execution_duration WHERE userId = ? ...
```

### 6. `domain/services/workflow-perf.service.ts`

```typescript
// getWorkflowTable(filters): WorkflowPerfRow[]
// WorkflowPerfRow = {
//   workflowId, name, totalExecutions,
//   successRate, avgDurationMs, p95DurationMs,
//   totalCostEur, lastExecutedAt
// }
// JOIN workflows ON id, JOIN v_execution_duration, JOIN v_token_cost
// Trié par totalCostEur DESC par défaut
```

### 7. `domain/services/heatmap.service.ts`

```typescript
// getActivityHeatmap(filters): { dayOfWeek: 0-6; hour: 0-23; count: number }[]
//   → EXTRACT(DOW) + EXTRACT(HOUR) FROM startedAt
//   → 168 cellules max (7j × 24h)
```

### 8. `presentation/controllers/analytics.controller.ts`

```
GET /analytics/summary
  ?userId=&from=&to=&compareWithPrevious=true
  → { cost: { total, delta, topModel }, executions: { total, successRate, p50, delta }, ... }

GET /analytics/cost/timeseries
  ?userId=&from=&to=&period=daily&model=
  → { period, data: [{ date, model, costEur, tokens }] }

GET /analytics/executions
  ?userId=&from=&to=&period=daily
  → { data: [{ date, total, succeeded, failed, successRate }] }

GET /analytics/workflows
  ?userId=&from=&to=&sortBy=costEur&order=desc&limit=20
  → WorkflowPerfRow[]

GET /analytics/agents
  ?userId=&from=&to=&limit=10
  → { agentId, name, calls, totalTokens, totalCostEur, avgCostPerCall }[]

GET /analytics/models
  ?userId=&from=&to=
  → { model, totalCostEur, share, totalTokens }[]

GET /analytics/heatmap
  ?userId=&from=&to=
  → { dayOfWeek, hour, count }[]

GET /analytics/team
  ?orgId=&from=&to=&limit=20             (ENTERPRISE seulement)
  → { userId, email, executions, totalCostEur, topWorkflow }[]
```

### 9. `presentation/controllers/export.controller.ts`

```
POST /analytics/export
  Body: { format: 'csv' | 'pdf', filters: AnalyticsFilters, sections: string[] }
  → { jobId }

GET  /analytics/export/:jobId → { status, downloadUrl?, expiresAt? }
```

**PDF report sections :**
1. Executive summary (KPI cards)
2. Coût dans le temps (chart image via `canvas` serveur-side)
3. Top 10 workflows par coût
4. Top 10 agents par coût
5. Répartition modèles
6. Tableau récapitulatif (toutes métriques)

---

## Phase 3 — gateway-service (modifications)

### 10. `infrastructure/config/env.validation.ts`

```typescript
ANALYTICS_SERVICE_URL: z.string().url().default('http://localhost:3018'),
```

### 11. `presentation/controllers/proxy.controller.ts`

```typescript
case 'analytics':
  return this.proxyTo(this.analyticsServiceUrl, path, req);
```

### 12. `presentation/guards/analytics-feature.guard.ts` *(nouveau)*

```typescript
// Lit planContext depuis le JWT (enrichi en Phase 4 de plan-subscriptions.md)
// Si planContext.analytics === false → 403 ANALYTICS_PLAN_REQUIRED
// Retourne { upgradeUrl: '/settings/billing' } dans le body 403
```

---

## Phase 4 — Frontend

### 13. `frontend/src/features/analytics/api/analytics.api.ts` *(refactor)*

Garder les endpoints token-usage existants, ajouter :

```typescript
analyticsApi.getSummary(filters): Promise<AnalyticsSummary>
analyticsApi.getCostTimeseries(filters): Promise<CostTimeseriesResponse>
analyticsApi.getExecutionVolume(filters): Promise<ExecutionVolumeResponse>
analyticsApi.getWorkflowPerformance(filters): Promise<WorkflowPerfRow[]>
analyticsApi.getAgentLeaderboard(filters): Promise<AgentStat[]>
analyticsApi.getModelBreakdown(filters): Promise<ModelStat[]>
analyticsApi.getActivityHeatmap(filters): Promise<HeatmapCell[]>
analyticsApi.getTeamAnalytics(filters): Promise<TeamRow[]>
analyticsApi.exportAnalytics(req): Promise<{ jobId: string }>
analyticsApi.getExportStatus(jobId): Promise<ExportStatus>
```

### 14. `frontend/src/features/analytics/hooks/`

```
useAnalyticsSummary.ts       # SWR, revalidation 5 min
useCostTimeseries.ts
useExecutionVolume.ts
useWorkflowPerformance.ts
useAgentLeaderboard.ts
useModelBreakdown.ts
useActivityHeatmap.ts
useTeamAnalytics.ts
useAnalyticsExport.ts        # poll /export/:jobId jusqu'à completed
```

### 15. `frontend/src/features/analytics/components/` *(nouveaux + refactor)*

```
AnalyticsDateRangePicker.tsx    # from/to + presets (7j, 30j, 90j, personnalisé)
AnalyticsPeriodToggle.tsx       # daily / weekly / monthly
AnalyticsSummaryCards.tsx       # 6 KPI cards avec sparkline + delta badge
CostTimeseriesChart.tsx         # recharts AreaChart (refactor TokenUsageChart)
ExecutionVolumeChart.tsx        # recharts ComposedChart (Bar + Line)
ModelBreakdownChart.tsx         # recharts PieChart / RadialBarChart
WorkflowPerformanceTable.tsx    # table triable : success% + durée + coût
AgentLeaderboard.tsx            # recharts HorizontalBarChart
ActivityHeatmap.tsx             # SVG custom 7×24 heatmap (pas de lib externe)
TeamAnalyticsTable.tsx          # breakdown utilisateur (Enterprise gate)
AnalyticsExportButton.tsx       # modal format + sections + bouton download
UpgradeAnalyticsBanner.tsx      # affiché si plan FREE/PRO
```

**Règle de taille** : chaque composant ≤ 150 lignes. `WorkflowPerformanceTable` et `TeamAnalyticsTable` extraient leur logique de colonnes dans `*-columns.ts`.

### 16. `frontend/app/(dashboard)/analytics/page.tsx` *(refactor complet)*

```tsx
// Layout en 3 zones :
// 1. Header : titre + AnalyticsDateRangePicker + AnalyticsPeriodToggle + ExportButton
// 2. KPI row : AnalyticsSummaryCards (6 cards)
// 3. Grid 2 colonnes :
//    Colonne gauche  : CostTimeseriesChart (pleine largeur), puis ExecutionVolumeChart
//    Colonne droite  : ModelBreakdownChart, puis AgentLeaderboard
// 4. Pleine largeur : WorkflowPerformanceTable
// 5. Pleine largeur : ActivityHeatmap
// 6. Pleine largeur : TeamAnalyticsTable (si Enterprise)
//
// Si plan FREE/PRO → UpgradeAnalyticsBanner à la place du contenu
```

### 17. `AnalyticsSummaryCards` — détail des 6 cards

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Coût total       │ │ Taux de succès   │ │ Exécutions/jour  │
│ €NN.NN   ▲+12%  │ │ 97.3%    ▼-1.2% │ │ 342      ▲+8%   │
└──────────────────┘ └──────────────────┘ └──────────────────┘
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Durée médiane    │ │ Coût par exéc.   │ │ Modèle top coût  │
│ 4.2s      P95:8s│ │ €0.003  ▲+5%    │ │ claude-sonnet-4  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

Chaque card : valeur principale + sparkline 7 points + badge delta coloré (vert/rouge).

### 18. `ActivityHeatmap` — SVG sans dépendance externe

```tsx
// 7 lignes (lundi → dimanche) × 24 colonnes (0h → 23h)
// Couleur : interpolation violette (opacité 0→1 selon count)
// Tooltip natif title= sur chaque cellule SVG
// Taille fixe : 24×7 rectangles de 18px avec gap 2px
```

### 19. Locales

```typescript
// frontend/src/locales/fr/analytics.ts — remplace/étend l'existant
// Clés ajoutées :
// analytics.summary.totalCost, analytics.summary.successRate,
// analytics.summary.execPerDay, analytics.summary.medianDuration,
// analytics.summary.costPerExec, analytics.summary.topModel,
// analytics.cost.title, analytics.executions.title,
// analytics.workflows.successRate, analytics.workflows.avgDuration,
// analytics.upgrade.title, analytics.upgrade.cta, ...

// frontend/src/locales/en/analytics.ts — identique EN
```

---

## Phase 5 — Performance & scalabilité

### 20. Cache Redis sur les endpoints analytics

```typescript
// TTL selon la granularité :
// period=daily   → cache 10 min (données du jour en cours changent)
// period=weekly  → cache 1h
// period=monthly → cache 6h
//
// Clé de cache : sha256(JSON.stringify(filters))
// Implémentation : @UseInterceptors(AnalyticsCacheInterceptor) sur le controller
```

### 21. Limitation de plage

```typescript
// Zod validator dans AnalyticsFiltersDto :
// MAX_RANGE_DAYS = { daily: 90, weekly: 365, monthly: 730 }
// Si from..to > MAX_RANGE_DAYS[period] → 400 RANGE_TOO_LARGE
// Évite les requêtes SQL full-table par accident
```

### 22. Requêtes parallèles dans les use-cases summary

```typescript
const [cost, execStats, topWorkflow, topAgent] = await Promise.all([
  this.costService.getCostSummary(filters),
  this.executionStats.getSummary(filters),
  this.workflowPerf.getTop1(filters),
  this.agentStats.getTop1(filters),
])
```

---

## Séquencement recommandé

```
Phase 1 (vues SQL)
  → Phase 2 (analytics-service) ←→ Phase 3 (gateway, parallèle)
      → Phase 4 frontend :
          14 (api) → 15 (hooks) → 15 (composants simples) → 16 (page)
          → 15 (composants complexes : heatmap, team) → 17 (locales)
      → Phase 5 (cache + guards)
```

---

## Risques

| Risque | Mitigation |
|--------|------------|
| Requêtes lentes sur millions de `token_usage` | Vue `v_token_cost` + index composite `(timestamp, userId)` créés en Phase 1 |
| `inputCostPer1kTokens` null sur modèles custom | `COALESCE(..., 0)` dans la vue SQL + warning affiché dans la card KPI |
| Composants > 150 lignes (heatmap, table) | `ActivityHeatmap` en SVG pur ≤ 120 lignes ; table extrait columns dans fichier séparé |
| Accès team analytics par user non-admin | Guard vérifie orgId dans le JWT + rôle ORG_ADMIN, pas seulement le plan |
| Cache Redis périmé après import massif de données | Endpoint `POST /analytics/cache/invalidate` (ADMIN seulement) |

---

## Hors scope (v1)

- Alertes automatiques (coût > seuil → email) — prévu v2
- Embedding analytics (usage vector-service) — prévu v2
- Dashboard partageable via lien public
- Intégration Grafana / BI externe
- Prévision de coût (régression linéaire) — prévu v2
