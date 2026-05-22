# Marketplace Beta — Plan d'implémentation
> 20 templates internes · 2 semaines · Produit différenciant pour acquisition

---

## Objectif
Ouvrir un marketplace de workflows pré-construits : l'utilisateur browse, prévisualise et installe un template en 1 clic dans son workspace.

---

## Phase 1 — Backend & Données (Jours 1–5)

### 1. Schéma Prisma — `packages/database/prisma/schema.prisma`
Ajouter les champs template sur `Workflow` :
```prisma
model Workflow {
  // ... champs existants ...
  isTemplate      Boolean   @default(false)
  category        String?                    // "Automation" | "AI" | "DevOps" | ...
  tags            String[]
  installsCount   Int       @default(0)
  previewImageUrl String?
  isFeatured      Boolean   @default(false)
  authorName      String?                    // affiché pour les templates internes
  @@index([isTemplate, category])
  @@index([isTemplate, isFeatured])
}
```
Migration : `pnpm prisma migrate dev --name add_template_fields`

---

### 2. Use Cases — `services/orchestration-service/src/application/use-cases/`

| Fichier | Rôle |
|---|---|
| `list-marketplace-templates.use-case.ts` | Lister templates publics, filtres category/tags, pagination |
| `get-marketplace-template.use-case.ts` | Détail d'un template (nodes, edges, description) |
| `install-template.use-case.ts` | Fork du template dans le workspace de l'user (réutilise `fork-workflow.use-case.ts`) + incrémente `installsCount` |

```typescript
// list-marketplace-templates.use-case.ts — interface attendue
export interface ListTemplatesQuery {
  category?: string
  search?: string
  page: number
  limit: number
}
export interface TemplateListItem {
  id: string
  name: string
  description: string | null
  category: string | null
  tags: string[]
  installsCount: number
  previewImageUrl: string | null
  isFeatured: boolean
  authorName: string | null
}
```

---

### 3. Controller REST — `services/orchestration-service/src/presentation/controllers/`
Nouveau fichier `marketplace.controller.ts` :

```
GET  /workflows/marketplace              → ListMarketplaceTemplatesUseCase
GET  /workflows/marketplace/categories  → liste des catégories distinctes
GET  /workflows/marketplace/:id         → GetMarketplaceTemplateUseCase
POST /workflows/marketplace/:id/install → InstallTemplateUseCase (auth required)
```

Pas de nouveau service — reste dans `orchestration-service` (les workflows y vivent déjà).

---

### 4. Gateway — `services/gateway-service/src/`
- `env.validation.ts` : vérifier que `ORCHESTRATION_SERVICE_URL` est déjà présent (l'orchestration est déjà proxifiée)
- `proxy.controller.ts` : le préfixe `/api/workflows/marketplace` passe déjà via le proxy orchestration existant → **aucun changement nécessaire** si la règle catch-all `/api/workflows/*` est déjà en place. Sinon ajouter une entrée explicite.

---

### 5. Seed — 20 templates internes
Créer `packages/database/prisma/seed-templates.ts` (appelé par `prisma db seed` ou script standalone) :

**Catégories & templates (20 total) :**

| # | Nom | Catégorie |
|---|-----|-----------|
| 1 | Email Digest quotidien | Automation |
| 2 | Résumé Slack hebdomadaire | Automation |
| 3 | Veille concurrentielle | AI |
| 4 | Rédaction de rapport mensuel | AI |
| 5 | Classification de tickets support | AI |
| 6 | Pipeline de traitement de documents | AI |
| 7 | Génération de synthèse de réunion | AI |
| 8 | Scraping & structuration de données | Data |
| 9 | Synchronisation CRM → base de données | Data |
| 10 | Export analytics vers Google Sheets | Data |
| 11 | CI/CD notification Slack | DevOps |
| 12 | Monitoring d'alertes GitHub | DevOps |
| 13 | Rapport de déploiement automatique | DevOps |
| 14 | Onboarding nouvel employé | HR |
| 15 | Suivi des candidatures recrutement | HR |
| 16 | Rappels de tâches Trello | Productivity |
| 17 | Gestion des deadlines projets | Productivity |
| 18 | Pipeline de génération de contenu | Marketing |
| 19 | Suivi des mentions réseaux sociaux | Marketing |
| 20 | Tableau de bord KPI automatique | Analytics |

Chaque seed : `isTemplate: true`, `visibility: PUBLIC`, `userId: SYSTEM_USER_ID`, `isFeatured: true` pour les 5 premiers.

---

## Phase 2 — Frontend (Jours 6–10)

### 6. Route Next.js — `frontend/app/(dashboard)/marketplace/`

```
marketplace/
  page.tsx              ← liste + filtres (orchestrateur, max 100 lignes)
  [id]/
    page.tsx            ← détail template
  layout.tsx            ← header "Marketplace"
```

---

### 7. Feature folder — `frontend/src/features/marketplace/`

```
marketplace/
  components/
    TemplateCard.tsx          ← carte grid (150 lignes max)
    TemplateGrid.tsx          ← grille responsive + skeleton
    CategoryFilter.tsx        ← chips de filtres
    TemplateDetailModal.tsx   ← modal prévisualisation + CTA "Installer"
    FeaturedBanner.tsx        ← banner top 5 featured
  hooks/
    useMarketplace.ts         ← fetch list + pagination
    useInstallTemplate.ts     ← mutation install + toast feedback
  types/
    marketplace.types.ts      ← TemplateListItem, TemplateDetail, Category
  api/
    marketplace.api.ts        ← appels vers NEXT_PUBLIC_API_URL/api/workflows/marketplace
```

---

### 8. i18n — OBLIGATOIRE

Créer `frontend/src/locales/en/marketplace.ts` et `frontend/src/locales/fr/marketplace.ts` :

```typescript
// en
export const marketplace = {
  title: 'Template Marketplace',
  subtitle: 'Start faster with pre-built workflows',
  search: { placeholder: 'Search templates...' },
  filter: { all: 'All', label: 'Category' },
  card: { installs: '{{count}} installs', install: 'Install', preview: 'Preview' },
  detail: { by: 'By {{author}}', tags: 'Tags', nodes: '{{count}} steps' },
  install: {
    success: 'Template installed in your workspace',
    error: 'Failed to install template',
    loading: 'Installing...',
  },
  empty: 'No templates found',
  featured: 'Featured',
}

// fr — mêmes clés
export const marketplace = {
  title: 'Marketplace de Templates',
  subtitle: 'Démarrez plus vite avec des workflows pré-construits',
  search: { placeholder: 'Rechercher des templates...' },
  filter: { all: 'Tous', label: 'Catégorie' },
  card: { installs: '{{count}} installations', install: 'Installer', preview: 'Aperçu' },
  detail: { by: 'Par {{author}}', tags: 'Tags', nodes: '{{count}} étapes' },
  install: {
    success: 'Template installé dans votre workspace',
    error: "Échec de l'installation",
    loading: 'Installation...',
  },
  empty: 'Aucun template trouvé',
  featured: 'En vedette',
}
```

Enregistrer dans `src/locales/{en,fr}/index.ts`.

---

### 9. Navigation — `frontend/src/components/` ou sidebar existante
Ajouter un lien "Marketplace" dans la sidebar dashboard avec une icône `Store` (Lucide).

---

## Séquence d'implémentation recommandée

```
Jour 1 — Migration Prisma + seed script (20 templates)
Jour 2 — list-marketplace use case + tests unitaires
Jour 3 — install-template use case + tests
Jour 4 — marketplace.controller.ts + tests intégration
Jour 5 — Vérification gateway proxy + smoke test API
---
Jour 6 — Types TS + marketplace.api.ts + hooks
Jour 7 — TemplateCard + TemplateGrid + CategoryFilter
Jour 8 — TemplateDetailModal + useInstallTemplate
Jour 9 — Page list + page detail + FeaturedBanner
Jour 10 — i18n complet, lien sidebar, QA end-to-end
```

---

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Migration Prisma en prod avec données existantes | `isTemplate` nullable → `@default(false)` sans backfill risqué |
| `installsCount` race condition (concurrent installs) | `$executeRaw("UPDATE ... SET installs_count = installs_count + 1")` |
| Templates trop lourds (nodes/edges JSON) | Exclure `nodes`/`edges` du list endpoint, les retourner seulement sur GET /:id |
| Gateway proxy pas configuré pour le nouveau préfixe | Vérifier la règle catch-all avant de déployer |

---

## Hors scope (beta)

- Ratings / reviews
- Upload de templates par des utilisateurs externes
- Versioning de templates
- Paiement / templates premium
- Analytics d'usage par template
