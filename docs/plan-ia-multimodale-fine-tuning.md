# IA Multi-Modale & Fine-Tuning — Plan d'implémentation
> Condition de lancement : **Différenciation long terme** — activer quand la plateforme entre en compétition directe avec des outils verticaux (Make, n8n AI, Zapier AI) ou sur décision de positionnement entreprise

---

## Objectif
Transformer la plateforme en moteur IA de premier plan : ingestion et raisonnement sur **images, audio, vidéo et documents** dans les workflows, puis **fine-tuning de modèles** sur les données propriétaires des clients pour une personnalisation irremplaçable.

---

## Contexte existant

| Ce qui existe | Limite actuelle |
|---|---|
| `model-service` (port 3003) — OpenAI, Anthropic, Google | Appels texte uniquement — aucun payload multimodal |
| `ProviderClientFactory` — OpenAI SDK, Anthropic SDK, Google GenAI | Clients créés mais sans gestion `content[]` multimodal |
| `document-service` — upload, stockage S3 | Fichiers stockés, jamais passés à un LLM |
| `vector-service` (port 3007) — embeddings Qdrant | Embeddings texte ; aucun embedding image/audio |
| `file-service` — gestion fichiers workspace | Métadonnées uniquement, pas de pipeline de traitement |
| `agent-service` — orchestration LLM | `ChatMessage.content: string` — mono-modal |

**Aucune capacité multimodale ni fine-tuning n'existe.** Tout est à construire.

---

## Architecture cible

```
[Workflow Step : "Analyse image"]
  │  input: { imageUrl, prompt }
  ▼
[orchestration-service]
  │  résout le type de step → "multimodal"
  ▼
[model-service]
  │  construit payload content[] → appel provider
  ├─ OpenAI   → vision / Whisper / TTS
  ├─ Anthropic → Claude vision
  └─ Google   → Gemini multimodal (image+audio+vidéo)

[Fine-Tuning Pipeline]
  dataset (JSONL) → validation → job provider → modèle custom → disponible dans model-service
```

---

## Phase 1 — Multimodal Core : Image & Document (Semaines 1–3)

### 1. Schéma Prisma — `packages/database/prisma/schema.prisma`

```prisma
model ModalityAsset {
  id          String        @id @default(cuid())
  workspaceId String
  type        ModalityType
  url         String         // S3 / GCS URL signé
  mimeType    String
  sizeBytes   Int
  durationMs  Int?           // audio/vidéo
  transcript  String?        // résultat Whisper
  metadata    Json           @default("{}")
  createdAt   DateTime       @default(now())
  workspace   Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@index([workspaceId, type])
}

enum ModalityType {
  IMAGE
  AUDIO
  VIDEO
  DOCUMENT_PDF
  DOCUMENT_SPREADSHEET
}
```

Migration : `pnpm prisma migrate dev --name add_modality_assets`

---

### 2. Types multimodaux — `packages/types/src/multimodal.ts`

```typescript
export type ImageBlock = {
  type: 'image'
  source: { kind: 'url'; url: string } | { kind: 'base64'; data: string; mimeType: string }
}

export type AudioBlock = {
  type: 'audio'
  source: { kind: 'url'; url: string }
  transcript?: string
}

export type DocumentBlock = {
  type: 'document'
  source: { kind: 'url'; url: string }
  mimeType: 'application/pdf' | 'text/csv'
}

export type TextBlock = { type: 'text'; text: string }

export type ContentBlock = TextBlock | ImageBlock | AudioBlock | DocumentBlock

export type MultimodalMessage = {
  role: 'user' | 'assistant'
  content: ContentBlock[]
}
```

---

### 3. Adaptateurs provider multimodaux — `services/model-service/src/infrastructure/adapters/`

| Fichier | Rôle |
|---|---|
| `multimodal-adapter.interface.ts` | Interface `IMultimodalAdapter` : `buildPayload(messages: MultimodalMessage[])` |
| `openai-multimodal.adapter.ts` | Construit `content[]` OpenAI (GPT-4o vision + file input) |
| `anthropic-multimodal.adapter.ts` | Construit `content[]` Anthropic (Claude 3.5 vision) |
| `google-multimodal.adapter.ts` | Construit `parts[]` Gemini 2.0 (image + audio + vidéo inline) |
| `multimodal-adapter.factory.ts` | Sélectionne l'adaptateur selon `provider` |

**Règle :** chaque adaptateur normalise le format `ContentBlock[]` interne vers le format SDK natif du provider. Aucune logique provider dans le use-case.

---

### 4. Use cases multimodaux — `services/model-service/src/application/use-cases/`

| Fichier | Rôle |
|---|---|
| `analyze-image.use-case.ts` | Analyse image + prompt → texte structuré |
| `analyze-document.use-case.ts` | PDF/CSV + prompt → extraction données |
| `multimodal-chat.use-case.ts` | Conversation avec mix texte + médias |

Interface use case :
```typescript
interface AnalyzeImageInput {
  modelId: string
  apiKeyId: string
  imageUrl: string
  prompt: string
  outputSchema?: z.ZodSchema    // JSON structuré si fourni
}
```

---

### 5. Contrôleur — `services/model-service/src/presentation/controllers/multimodal.controller.ts`

```
POST /multimodal/image/analyze
POST /multimodal/document/analyze
POST /multimodal/chat
```

Validation Zod à chaque endpoint. Rate-limit : 60 req/min/workspace.

---

### 6. Proxy gateway — `services/gateway-service/src/`

Ajouter dans `proxy.controller.ts` :
```typescript
case 'models':
  return this.proxyService.forward(req, res, this.config.MODEL_SERVICE_URL)
```

Routes exposées : `/api/models/multimodal/*`

---

### 7. Workflow step "Multimodal" — `services/orchestration-service/src/`

Nouveau type de step dans le domaine :
```typescript
type MultimodalStep = {
  kind: 'multimodal'
  provider: 'openai' | 'anthropic' | 'google'
  modelId: string
  inputBinding: {
    imageUrl?: string      // référence à une variable du workflow
    audioUrl?: string
    documentUrl?: string
    prompt: string
  }
  outputVariable: string  // stocke le résultat dans le contexte du workflow
}
```

Exécuteur : `multimodal-step.executor.ts` — POST vers `model-service/multimodal/image/analyze`.

---

### 8. UI — step multimodal dans l'éditeur — `frontend/src/features/workflows/`

| Fichier | Rôle |
|---|---|
| `MultimodalStepForm.tsx` | Formulaire : sélection provider/model, upload média, prompt |
| `MediaPreview.tsx` | Aperçu image/PDF dans le panneau de step (< 150 lignes) |
| `use-multimodal-step.ts` | Hook : validation, envoi, résultat |

i18n : ajouter clés dans `en/workflows.ts` et `fr/workflows.ts`.

---

## Phase 2 — Audio & Vidéo (Semaines 4–5)

### 9. Transcription audio — `services/model-service/src/application/use-cases/`

| Fichier | Rôle |
|---|---|
| `transcribe-audio.use-case.ts` | Audio URL → texte (Whisper via OpenAI, ou Gemini Audio) |
| `text-to-speech.use-case.ts` | Texte → audio MP3 (OpenAI TTS, Google TTS) |

Formats supportés : MP3, MP4, WAV, WEBM (max 25 Mo OpenAI / 20 Mo Gemini).

Workflow step : `"transcription"` — sortie : `{ text, durationMs, language }`.

---

### 10. Analyse vidéo — Google Gemini uniquement (v1)

- `analyze-video.use-case.ts` — URL vidéo (GCS) → description, résumé, extraction frames clés
- Limite v1 : vidéo < 1 Go, durée < 1h, uniquement via Gemini 2.0 Flash
- Upload intermédiaire : `file-service` → GCS → URL signée passée à Gemini Files API

Workflow step : `"video-analysis"` — sortie : `{ summary, keyMoments: [{timestampMs, description}] }`.

---

### 11. Pipeline de preprocessing — `services/file-service/src/application/`

| Fichier | Rôle |
|---|---|
| `resize-image.use-case.ts` | Redimensionner images > 5 Mo avant envoi provider (sharp) |
| `extract-pdf-pages.use-case.ts` | Découper PDF > 20 pages en chunks (pdf-lib) |
| `validate-media-type.use-case.ts` | Vérifier MIME type et taille avant upload |

---

## Phase 3 — Fine-Tuning (Semaines 6–10)

> Condition de démarrage phase 3 : au moins 3 clients enterprise avec ≥ 1 000 échanges LLM/mois.

### 12. Schéma Prisma — Fine-tuning jobs

```prisma
model FineTuneJob {
  id              String          @id @default(cuid())
  workspaceId     String
  provider        String          // "openai" | "google"
  baseModelId     String          // ex. "gpt-4o-mini-2024-07-18"
  fineTunedModelId String?        // rempli quand job terminé
  status          FineTuneStatus
  datasetId       String
  trainingFileId  String?         // ID fichier côté provider
  providerJobId   String?
  hyperparams     Json            @default("{}")
  costEstimateUsd Decimal?
  startedAt       DateTime?
  completedAt     DateTime?
  errorMessage    String?
  createdAt       DateTime        @default(now())
  workspace       Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  dataset         FineTuneDataset @relation(fields: [datasetId], references: [id])
  @@index([workspaceId, status])
}

enum FineTuneStatus {
  DRAFT
  VALIDATING
  QUEUED
  RUNNING
  SUCCEEDED
  FAILED
  CANCELLED
}

model FineTuneDataset {
  id          String         @id @default(cuid())
  workspaceId String
  name        String
  description String?
  rowCount    Int            @default(0)
  sizeBytes   Int            @default(0)
  format      DatasetFormat
  storageUrl  String         // S3/GCS path du fichier JSONL
  validated   Boolean        @default(false)
  jobs        FineTuneJob[]
  createdAt   DateTime       @default(now())
  workspace   Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

enum DatasetFormat {
  OPENAI_CHAT       // {messages: [{role, content}]}
  GOOGLE_TUNING     // {input_text, output_text}
}
```

Migration : `pnpm prisma migrate dev --name add_fine_tune`

---

### 13. Service dédié — `services/fine-tune-service/` (nouveau microservice)

Port : **3023**

```
fine-tune-service/src/
├── domain/
│   ├── entities/fine-tune-job.entity.ts
│   ├── entities/fine-tune-dataset.entity.ts
│   └── repositories/fine-tune.repository.interface.ts
├── application/use-cases/
│   ├── create-dataset.use-case.ts
│   ├── validate-dataset.use-case.ts       # format JSONL, min 10 exemples
│   ├── start-fine-tune-job.use-case.ts
│   ├── poll-fine-tune-job.use-case.ts     # cron toutes les 2 min
│   ├── cancel-fine-tune-job.use-case.ts
│   └── list-fine-tuned-models.use-case.ts
├── infrastructure/
│   ├── providers/
│   │   ├── openai-fine-tune.provider.ts   # Files API + Fine-tuning API
│   │   └── google-fine-tune.provider.ts   # Vertex AI Tuning API
│   ├── database/fine-tune.repository.ts
│   └── cron/fine-tune-poller.cron.ts      # polling status jobs actifs
└── presentation/controllers/
    ├── dataset.controller.ts
    └── fine-tune.controller.ts
```

Scaffolding : `/create-service fine-tune-service 3023 "Fine-tuning pipeline for custom model training"`

---

### 14. Use cases détaillés

**`validate-dataset.use-case.ts`**
```typescript
// Règles de validation OpenAI
// - Format JSONL strict : chaque ligne = { messages: [{role, content}] }
// - Min 10 exemples, max 50 000
// - Chaque exemple < 65 536 tokens
// - Ratio train/validation recommandé : 90/10
// - Doit contenir au moins un message role: "assistant"
```

**`start-fine-tune-job.use-case.ts`**
```typescript
// 1. Upload dataset JSONL → provider Files API
// 2. Créer job fine-tune avec hyperparams
// 3. Sauvegarder providerJobId
// 4. Emit NATS event: fine_tune.job.started
```

**`poll-fine-tune-job.use-case.ts`**
```typescript
// Cron toutes les 2 min (NestJS ScheduleModule)
// GET status job → provider
// Si SUCCEEDED : mettre à jour fineTunedModelId, notifier user via push
// Si FAILED : sauvegarder errorMessage, notifier
```

---

### 15. Intégration model-service — `services/model-service/src/`

Quand `modelId` préfixe `ft:` ou `tunedModels/` → route vers le provider propriétaire du fine-tune.

```typescript
// model.repository.ts — ajouter
async findFineTunedModels(workspaceId: string): Promise<FineTunedModel[]> {
  // Récupère depuis fine-tune-service via HTTP interne
}
```

Les modèles fine-tunés apparaissent dans le sélecteur de modèle du workflow avec badge "Custom".

---

### 16. Export dataset depuis les conversations — `services/agent-service/src/`

| Fichier | Rôle |
|---|---|
| `export-training-data.use-case.ts` | Convertit `ChatMessage[]` → format JSONL OpenAI/Google |
| `dataset-export.controller.ts` | `POST /agents/:id/export-training-data` |

Filtres disponibles : plage de dates, évaluations utilisateur (thumbs up uniquement), sessions taguées.

---

### 17. UI Fine-Tuning — `frontend/src/features/fine-tuning/` (nouvelle feature)

**Pages**

| Route | Composant | Rôle |
|---|---|---|
| `/fine-tuning` | `FineTuningDashboard.tsx` | Liste datasets + jobs, KPIs |
| `/fine-tuning/datasets/new` | `DatasetUpload.tsx` | Upload JSONL, validation client-side |
| `/fine-tuning/datasets/:id` | `DatasetDetail.tsx` | Preview exemples, statut validation |
| `/fine-tuning/jobs/new` | `CreateFineTuneJob.tsx` | Sélection dataset, modèle de base, hyperparams |
| `/fine-tuning/jobs/:id` | `FineTuneJobDetail.tsx` | Progression, logs, résultats |

**Composants partagés**

| Composant | Rôle |
|---|---|
| `DatasetValidator.tsx` | Validation JSONL client-side avant upload (< 150 lignes) |
| `HyperparamForm.tsx` | epochs, learning rate, batch size avec tooltips |
| `FineTuneStatusBadge.tsx` | Badge coloré par statut |
| `CostEstimator.tsx` | Estimation coût en $ selon taille dataset + provider |

---

### 18. Coût & Limites (garde-fous)

| Règle | Implémentation |
|---|---|
| Estimation coût avant lancement | `CostEstimator` : tokens × tarif provider → validation utilisateur |
| Budget max par workspace | `FineTuneJob.costLimitUsd` — job refusé si dépassé |
| Un seul job actif par workspace | Vérification dans `start-fine-tune-job.use-case.ts` |
| Dataset supprimé si job > 90 jours | Cron cleanup + notification 7j avant |
| Audit log | Chaque action fine-tune → `AuditLog` (RGPD) |

---

## Phase 4 — Embeddings Multimodaux & Recherche (Semaine 11–12)

### 19. Embeddings image — `services/vector-service/src/`

Étendre `EmbeddingService` :
```typescript
// embedding.service.ts — ajouter
async embedImage(imageUrl: string, provider: 'openai' | 'google'): Promise<number[]> {
  // OpenAI : text-embedding-3 sur description générée (2 étapes)
  // Google  : multimodalembedding@001 (image native)
}
```

Nouveau type de collection Qdrant : `workspace_images` — vecteurs 1408 dimensions (Google) ou 3072 (OpenAI).

---

### 20. Recherche multimodale — `services/vector-service/src/application/use-cases/`

| Fichier | Rôle |
|---|---|
| `search-by-image.use-case.ts` | Image query → documents/images similaires |
| `search-cross-modal.use-case.ts` | Texte → images, ou image → texte |

Exposé via `GET /vector/search/image` et `GET /vector/search/cross-modal`.

---

## Risques & Mitigations

| Risque | Mitigation |
|---|---|
| Coûts fine-tuning incontrôlés | Budget max obligatoire, estimation avant lancement, alertes 50%/80%/100% |
| Données clients cross-contamination | `workspaceId` isolé à chaque niveau ; datasets jamais partagés entre workspaces |
| Latence vision élevée (5–15s) | Streaming côté UI + indicateur de progression ; timeout 120s |
| Format JSONL invalide bloquant le job | Validation stricte client + serveur avant upload provider |
| Modèle fine-tuné indisponible provider | Fallback automatique vers modèle de base + notification |
| Vidéo : fichiers > 1 Go | Validation taille avant upload, message d'erreur explicite |
| Google Vertex AI : latence activation | Pré-provisionner endpoint dans les régions cibles dès le début |

---

## Dépendances

```bash
# model-service
pnpm --filter @multi-agent/model-service add sharp pdf-lib

# fine-tune-service (nouveau)
pnpm --filter @multi-agent/fine-tune-service add openai @google-cloud/aiplatform

# frontend
pnpm --filter frontend add react-dropzone
```

---

## Séquence d'implémentation

```
Phase 1 : Types multimodaux → Adaptateurs provider → Use cases image/doc → Step workflow → UI step
Phase 2 : Transcription audio → Analyse vidéo → Preprocessing pipeline
Phase 3 : Schéma fine-tune → fine-tune-service scaffold → Providers → Polling cron → Export dataset → UI fine-tuning
Phase 4 : Embeddings image → Recherche cross-modale
```

---

## Critères de validation (Definition of Done)

### Phase 1
- [ ] Analyse image fonctionne sur OpenAI, Anthropic et Google depuis un step workflow
- [ ] PDF 20 pages analysé et résumé en < 30 s
- [ ] Aucune clé API exposée dans les logs ni le frontend
- [ ] i18n : zéro string hardcodée dans l'UI multimodale

### Phase 2
- [ ] Transcription MP3 10 min → texte en < 45 s (Whisper)
- [ ] Analyse vidéo 5 min → keyMoments corrects (Gemini)

### Phase 3
- [ ] Dataset 100 exemples validé et uploadé en < 10 s
- [ ] Job fine-tuning lancé et polling opérationnel
- [ ] Modèle custom disponible dans le sélecteur de modèle du workflow
- [ ] Estimation de coût affichée avant lancement
- [ ] Coverage use cases fine-tune ≥ 80%

### Phase 4
- [ ] Recherche image → documents similaires en < 500 ms

---

## Out of Scope (v1)

- Fine-tuning Anthropic (Claude) — API non disponible publiquement à ce jour
- Fine-tuning sur GPU on-premise (v2 — pour clients air-gapped)
- Évaluation automatisée de qualité du modèle fine-tuné (v2)
- Distillation de modèles (GPT-4o → GPT-4o-mini) (v2)
- Vision temps réel / streaming vidéo live (v3)
