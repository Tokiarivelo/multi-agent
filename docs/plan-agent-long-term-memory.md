# Plan d'implémentation — Mémoire Long Terme des Agents

## Objectif

Donner à chaque agent une mémoire persistante qui survit aux sessions : faits sur l'utilisateur, préférences, contexte projet, expériences passées. L'agent récupère automatiquement les souvenirs pertinents avant chaque réponse et en génère de nouveaux après chaque interaction. Différenciation clé pour la rétention : un agent qui "se souvient" est irremplaçable.

---

## Contexte existant

| Ce qui existe | Limite actuelle |
|---------------|-----------------|
| `vector-service` (port 3007) — Qdrant, embeddings multi-provider | Utilisé uniquement pour les fichiers workspace (RAG documentaire) |
| `VectorClientService` dans `agent-service` — `searchFiles()` | Recherche fichiers uniquement, pas de mémoire agent |
| `ChatSession.memoryContext: Json?` | Champ JSON non typé, jamais écrit ni lu en pratique |
| `EmbeddingService` — OpenAI, Azure, Google, Ollama | Infrastructure embedding 100% réutilisable |
| `ChatMessage` — historique de session | Mémoire court terme (session active), non persistée entre sessions |
| `AgentExecution` + `TokenUsage` | Données d'exécution, pas de sémantique mémoire |

**Aucune mémoire long terme n'existe.** Les agents oublient tout entre les sessions.

---

## Taxonomie de la mémoire

| Type | Description | Exemples |
|------|-------------|----------|
| **SEMANTIC** | Faits stables sur l'utilisateur, le projet, le domaine | "L'utilisateur travaille dans la fintech", "Le stack est NestJS+Prisma" |
| **EPISODIC** | Expériences passées notables | "En mars, l'utilisateur avait besoin d'un script de migration — on a utilisé l'outil X" |
| **PREFERENCE** | Habitudes et préférences de travail | "Préfère les réponses courtes", "Toujours demander confirmation avant suppression" |
| **PROCEDURAL** | Comment bien accomplir des tâches pour cet agent | "Pour les requêtes SQL, vérifier d'abord le schéma via le tool DB" |

---

## Port réservé

| Service         | Port |
|-----------------|------|
| memory-service  | 3022 |

---

## Architecture cible

```
[Chat / Exécution workflow]
  │
  ▼
[agent-service]
  ├── AVANT réponse : GET /memory/retrieve?agentId=&query=&userId=
  │     → memory-service → Qdrant semantic search → top-K souvenirs
  │     → injecté comme bloc de contexte avant le system prompt
  │
  ├── APRÈS réponse : POST /memory/extract (async, fire-and-forget)
  │     → memory-service → LLM extraction → upsert Qdrant + AgentMemory DB
  │
  └── Sur trigger utilisateur : POST /memory/remember (explicite)
        → l'agent dit "je vais me souvenir de ça"

[memory-service :3022]
  ├── Qdrant collection par user : agent_memory_{userId}
  │     payload: { agentId, type, content, importance, accessCount, ... }
  ├── AgentMemory table (PostgreSQL) : index + métadonnées sans le vecteur
  ├── Cron consolidation (2h du matin) : déduplication + decay importance
  └── API CRUD pour le frontend (gestion manuelle des souvenirs)

[gateway-service :3000]
  └── /api/memory/* → proxy → memory-service

[Frontend]
  └── /agents/:id/memory → interface gestion mémoire
```

---

## Phase 1 — Base de données

### 1. `packages/database/prisma/schema.prisma`

```prisma
model AgentMemory {
  id              String         @id @default(uuid())
  userId          String
  agentId         String
  // Identifiant du point Qdrant (pour MAJ/suppression)
  qdrantPointId   String         @unique
  type            MemoryType
  // Contenu en clair (pour affichage UI + re-embedding si modèle change)
  content         String
  // Métadonnées comportement
  importance      Float          @default(0.7)  // 0-1, décroît avec le temps
  accessCount     Int            @default(0)    // incrémenté à chaque retrieve
  lastAccessedAt  DateTime?
  // Provenance
  source          MemorySource   @default(AUTO)
  sessionId       String?        // ChatSession source si AUTO
  executionId     String?        // WorkflowExecution source si AUTO
  // Cycle de vie
  consolidatedAt  DateTime?      // date de la dernière consolidation
  archivedAt      DateTime?      // null = actif
  tags            String[]       @default([])
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  agent           Agent          @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([userId, agentId])
  @@index([agentId, type])
  @@index([importance])
  @@index([lastAccessedAt])
  @@map("agent_memories")
}

enum MemoryType   { SEMANTIC EPISODIC PREFERENCE PROCEDURAL }
enum MemorySource { AUTO EXPLICIT IMPORTED }
```

> Ajouter `memories AgentMemory[]` sur `User` et `Agent`.

### 2. Collection Qdrant — convention de nommage

```
agent_memory_{userId}
```

Une collection par utilisateur (pas par agent) pour mutualiser les embeddings et permettre la mémoire cross-agent dans le futur. Le `agentId` est un filtre dans le payload Qdrant.

**Payload Qdrant par point :**
```json
{
  "agentMemoryId": "<uuid>",
  "agentId": "<uuid>",
  "type": "SEMANTIC",
  "content": "L'utilisateur préfère des réponses en français",
  "importance": 0.8,
  "accessCount": 3,
  "tags": ["language", "preference"]
}
```

---

## Phase 2 — memory-service (nouveau microservice)

> Scaffolder avec `/create-service memory 3022 "Mémoire long terme des agents — stockage, extraction, retrieval"`

### 3. Structure

```
services/memory-service/src/
├── domain/
│   ├── entities/agent-memory.entity.ts
│   └── services/
│       ├── memory-extraction.service.ts  # LLM → extraire faits d'une conversation
│       ├── memory-retrieval.service.ts   # Qdrant search → top-K + MAJ accessCount
│       ├── memory-dedup.service.ts       # similarity > 0.92 → update vs insert
│       ├── memory-decay.service.ts       # importance scoring + archivage
│       └── memory-consolidation.service.ts # merge souvenirs similaires
├── application/
│   ├── use-cases/
│   │   ├── retrieve-memories.use-case.ts
│   │   ├── extract-and-store.use-case.ts
│   │   ├── remember-explicit.use-case.ts
│   │   ├── forget-memory.use-case.ts
│   │   ├── list-memories.use-case.ts
│   │   └── consolidate-memories.use-case.ts
│   └── dto/
│       ├── retrieve-memories.dto.ts
│       ├── extract-memories.dto.ts
│       └── create-memory.dto.ts
├── infrastructure/
│   ├── vector/memory-vector.client.ts   # wraps vector-service HTTP
│   ├── llm/memory-llm.client.ts         # appelle agent-service ou model-service
│   ├── database/agent-memory.repository.ts
│   └── cron/memory-maintenance.cron.ts  # decay + consolidation
└── presentation/
    ├── controllers/
    │   ├── memory-retrieval.controller.ts
    │   ├── memory-management.controller.ts
    │   └── memory-admin.controller.ts
    └── guards/memory-owner.guard.ts
```

### 4. `domain/services/memory-extraction.service.ts`

```typescript
// extractFromConversation(messages: ChatMessage[], agentId: string, userId: string): Promise<MemoryCandidate[]>
//
// Prompt LLM envoyé (system) :
// "Analyse cette conversation et extrait 3 à 5 faits importants à retenir
// sur l'utilisateur, ses préférences, son contexte ou ses besoins récurrents.
// Format JSON strict : [{type, content, importance, tags}]
// Importance : 0.9 (critique) à 0.5 (anecdotique).
// N'inclus que des faits vérifiables, pas des suppositions.
// Ne mentionne pas le contenu des messages textuels, seulement les intentions."
//
// Utilise le modèle le moins cher (claude-haiku ou gpt-4o-mini)
// Budget max : 1000 tokens d'input + 300 tokens d'output par extraction
```

### 5. `domain/services/memory-retrieval.service.ts`

```typescript
// retrieve(query: string, agentId: string, userId: string, limit = 8): Promise<AgentMemory[]>
//   1. Génère l'embedding du query (via vector-service)
//   2. Qdrant search sur agent_memory_{userId} avec filtre agentId
//   3. Score threshold : 0.65 (évite les souvenirs non pertinents)
//   4. Pondération finale : score_final = qdrant_score * 0.6 + importance * 0.3 + recency * 0.1
//   5. MAJ accessCount + lastAccessedAt (fire-and-forget en DB)
//   6. Retourne les top-limit souvenirs triés par score_final

// buildMemoryBlock(memories: AgentMemory[]): string
//   → Bloc injecté avant le system prompt :
//   "=== Mémoire de l'agent ===
//    [PREFERENCE] L'utilisateur préfère des réponses concises (importance: 0.9)
//    [SEMANTIC] Le projet utilise NestJS avec Prisma ORM (importance: 0.8)
//    ...
//    === Fin de la mémoire ==="
```

### 6. `domain/services/memory-dedup.service.ts`

```typescript
// checkDuplicate(newContent: string, agentId: string, userId: string): Promise<string | null>
//   → Embedding du newContent
//   → Qdrant search top-1 avec seuil 0.92
//   → Si trouvé : retourne l'ID existant (pour MAJ importance plutôt qu'insert)
//   → Sinon : retourne null (insert autorisé)
```

### 7. `domain/services/memory-decay.service.ts`

```typescript
// applyDecay(): Promise<{ archived: number; updated: number }>
//   Pour chaque mémoire active :
//   - Non accédée depuis 30 jours  → importance *= 0.8
//   - Non accédée depuis 90 jours  → importance *= 0.5
//   - Non accédée depuis 180 jours → importance *= 0.2
//   - importance < 0.1 ET source == AUTO → archivée (archivedAt = now)
//   - importance < 0.1 ET source == EXPLICIT → préservée (jamais archivée auto)
//
// Les souvenirs EXPLICIT (créés manuellement par l'utilisateur) ne décroissent pas.
```

### 8. `application/use-cases/retrieve-memories.use-case.ts`

```typescript
// execute(dto: RetrieveMemoriesDto): Promise<RetrieveMemoriesResult>
//   → retrieval.service.retrieve()
//   → Construit le bloc mémoire
//   → Retourne { memories, contextBlock, retrievalMs }
```

### 9. `application/use-cases/extract-and-store.use-case.ts`

```typescript
// execute(dto: ExtractMemoriesDto): Promise<void>
//   1. extraction.service.extractFromConversation()
//   2. Pour chaque MemoryCandidate :
//      a. dedup.service.checkDuplicate()
//      b. Si doublon : MAJ importance = max(existing, new) dans DB + Qdrant
//      c. Sinon : upsert dans Qdrant + INSERT dans AgentMemory
//   3. Émet NATS 'memory.extracted' { agentId, count, userId }
// Appelé en fire-and-forget depuis agent-service (pas de timeout critique)
```

### 10. `presentation/controllers/memory-retrieval.controller.ts`

```
GET /memory/retrieve
  ?agentId=&userId=&query=<texte_courant>&limit=8
  → RetrieveMemoriesResult { memories[], contextBlock }
  TTL cache Redis : 30s (même query deux fois de suite)

POST /memory/extract
  Body: { agentId, userId, sessionId?, messages: [{role, content}] }
  → 202 Accepted — traitement asynchrone
```

### 11. `presentation/controllers/memory-management.controller.ts`

```
GET    /memory
  ?agentId=&userId=&type=&page=&limit=
  → AgentMemory[] paginé, trié par importance DESC

POST   /memory
  Body: { agentId, userId, type, content, importance?, tags? }
  → Création mémoire EXPLICIT (par l'utilisateur ou l'agent lui-même)

PUT    /memory/:id
  Body: { content?, importance?, tags? }
  → MAJ (propriétaire seulement)

DELETE /memory/:id
  → Supprime en DB + supprime le point Qdrant
  → Toujours autorisé par le propriétaire

POST /memory/forget-topic
  Body: { agentId, userId, topic: string }
  → Recherche sémantique + archive tous les souvenirs proches
  → Cas d'usage : "oublie tout ce que tu sais sur mon ancien projet"

POST /memory/import
  Body: { agentId, userId, memories: CreateMemoryDto[] }
  → Import bulk depuis une autre session ou un fichier
```

### 12. `infrastructure/cron/memory-maintenance.cron.ts`

```typescript
@Cron('0 2 * * *')  // 2h du matin
async runMaintenance(): Promise<void> {
  await this.decayService.applyDecay()
  await this.consolidationService.mergeNearDuplicates()  // similarity > 0.95
  // Émet NATS 'memory.maintenance.completed' avec stats
}
```

---

## Phase 3 — Intégration dans agent-service

### 13. `infrastructure/external/memory-client.service.ts` *(nouveau)*

```typescript
@Injectable()
export class MemoryClientService {
  private readonly baseUrl: string

  // retrieve(agentId, userId, query): Promise<{ contextBlock: string; memories: AgentMemory[] }>
  //   → GET /memory/retrieve — timeout 800ms max
  //   → Si timeout/erreur → retourne { contextBlock: '', memories: [] } (graceful degrade)

  // extractAsync(agentId, userId, sessionId, messages): void
  //   → POST /memory/extract — fire-and-forget, jamais d'attente
}
```

### 14. `application/use-cases/execute-agent.use-case.ts` *(modification)*

**Avant la génération LLM**, insérer après le bloc RAG fichiers :

```typescript
// ~ligne 272, après ragContextBlock :
let memoryBlock = ''
if (dto.agentId && !dto.isTest) {
  const result = await this.memoryClient.retrieve(dto.agentId, ragUserId, dto.input)
  memoryBlock = result.contextBlock  // '' si vide ou erreur
}

// Ordre des blocs dans le system prompt :
// 1. systemPrompt de l'agent
// 2. memoryBlock (mémoire long terme)
// 3. ragContextBlock (fichiers workspace)
// 4. messages de la conversation courante
```

**Après la génération LLM**, en fire-and-forget :

```typescript
// ~fin de la méthode, avant le return :
if (dto.agentId && !dto.isTest && conversationMessages.length >= 2) {
  this.memoryClient.extractAsync(dto.agentId, ragUserId, dto.sessionId, conversationMessages)
}
```

### 15. `application/use-cases/chat-message.use-case.ts` *(modification)*

Même pattern : retrieve avant LLM, extractAsync après.

Pour le chat, extraire seulement si la session a ≥ **6 messages** (évite les extractions sur des conversations trop courtes).

### 16. `infrastructure/config/env.validation.ts` (agent-service)

```typescript
MEMORY_SERVICE_URL: z.string().url().default('http://localhost:3022'),
```

---

## Phase 4 — Gateway

### 17. `infrastructure/config/env.validation.ts` (gateway)

```typescript
MEMORY_SERVICE_URL: z.string().url().default('http://localhost:3022'),
```

### 18. `presentation/controllers/proxy.controller.ts`

```typescript
case 'memory':
  target = this.configService.get('MEMORY_SERVICE_URL', 'http://localhost:3022')
  break;
```

```typescript
@All('memory/*')
proxyMemory(@Req() req, @Res() res, @Next() next) {
  return this.proxyMiddleware(req, res, next)
}
```

---

## Phase 5 — Frontend

### 19. `frontend/src/features/memory/` *(nouveau)*

```
features/memory/
├── components/
│   ├── MemoryList.tsx             # liste des souvenirs avec filtres type/importance
│   ├── MemoryCard.tsx             # carte souvenir : badge type + importance + tags + date
│   ├── MemoryImportanceBar.tsx    # barre colorée 0-1 (vert → orange → rouge)
│   ├── AddMemoryModal.tsx         # formulaire création mémoire EXPLICIT
│   ├── ForgetTopicModal.tsx       # "oublier tout sur un sujet"
│   ├── MemoryStats.tsx            # nb total, répartition par type, dernière extraction
│   └── MemoryEmptyState.tsx       # illustration + CTA "Commencez à chatter"
├── hooks/
│   ├── useAgentMemories.ts        # SWR GET /api/memory?agentId=
│   └── useMemoryMutations.ts      # create, delete, forgetTopic
└── index.ts
```

### 20. `frontend/app/(dashboard)/agents/[id]/memory/page.tsx` *(nouveau)*

```
URL : /agents/:agentId/memory

Layout :
┌────────────────────────────────────────────────────────┐
│ ← Agent "Mon Assistant"        [+ Ajouter] [Oublier…]│
├────────────────────────────────────────────────────────┤
│ MemoryStats : 47 souvenirs · SEMANTIC 18 · PREF 12 …  │
├──────────────┬─────────────────────────────────────────┤
│ Filtres      │ Liste des souvenirs                     │
│ □ SEMANTIC   │ ┌──────────────────────────────────────┐│
│ □ EPISODIC   │ │[PREFERENCE] ●●●●●●●○○○ 0.8          ││
│ □ PREFERENCE │ │ "Préfère les réponses en français"   ││
│ □ PROCEDURAL │ │ tags: language · 12 accès · il y a 2j││
│              │ │                      [Modifier][✗]   ││
│ Importance   │ └──────────────────────────────────────┘│
│ ≥ [0.5 ▼]   │ ┌──────────────────────────────────────┐│
│              │ │[SEMANTIC] ●●●●●●●●○○ 0.9             ││
│              │ │ "Stack: NestJS, Prisma, NATS"        ││
│              │ └──────────────────────────────────────┘│
└──────────────┴─────────────────────────────────────────┘
```

### 21. Indicateur visuel dans le chat *(modification légère)*

Quand des souvenirs sont récupérés, afficher un badge discret :

```tsx
// Dans le chat header ou sous la barre de saisie :
{memoriesUsed > 0 && (
  <span className="text-xs text-muted-foreground">
    🧠 {t('memory.used', { count: memoriesUsed })}
  </span>
)}
```

### 22. Locales

```typescript
// frontend/src/locales/fr/memory.ts
// Clés : memory.title, memory.empty, memory.types.semantic, memory.types.episodic,
//        memory.types.preference, memory.types.procedural,
//        memory.add, memory.forget, memory.used, memory.importance,
//        memory.stats.total, memory.stats.lastExtracted

// frontend/src/locales/en/memory.ts
```

---

## Phase 6 — Consolidation & qualité mémoire

### 23. Prompt d'extraction — qualité et contraintes

```typescript
// Contraintes strictes dans le prompt LLM d'extraction :
// ✓ Faits vérifiables uniquement ("préfère X", "travaille sur Y", "utilise Z")
// ✗ Pas de supposition ("semble aimer X")
// ✗ Pas de contenu transactionnel ("a demandé de faire X ce soir")
// ✗ Pas de secrets ou données personnelles sensibles
// ✗ Maximum 200 caractères par souvenir
// ✓ Importance 0.9 : critère de travail permanent
// ✓ Importance 0.7 : préférence forte
// ✓ Importance 0.5 : information utile mais mineure
```

### 24. Consolidation — `memory-consolidation.service.ts`

```typescript
// mergeNearDuplicates(): Promise<void>
//   1. Charge tous les souvenirs actifs par agentId par batch de 100
//   2. Clustering léger : si deux souvenirs ont similarity > 0.95
//      → garde celui avec importance la plus haute
//      → ajoute les tags de l'autre
//      → supprime le doublon (Qdrant + DB)
//
// summarizeEpisodicToSemantic(): Promise<void>
//   Si un agent a > 20 souvenirs EPISODIC sur le même tag
//   → appel LLM pour synthétiser en 2-3 souvenirs SEMANTIC
//   → archive les épisodiques sources
```

### 25. Limites par plan

| Plan | Souvenirs max par agent | Extraction auto | Consolidation |
|------|------------------------|-----------------|---------------|
| FREE | 20 (EXPLICIT seulement) | ✗              | ✗             |
| PRO  | 200                     | ✓              | ✗             |
| BUSINESS | 2 000              | ✓              | ✓ mensuelle   |
| ENTERPRISE | illimité         | ✓              | ✓ hebdomadaire|

La limite FREE est enforced dans `extract-and-store.use-case.ts` : compte les souvenirs actifs avant insertion.

---

## Séquencement recommandé

```
Phase 1 (DB + Qdrant collection)
  → Phase 2 (memory-service complet)
      → Phase 3 (agent-service : retrieve + extractAsync)   ← priorité rétention
          → Phase 4 (gateway proxy)
              → Phase 5 (frontend)
                  → Phase 6 (consolidation + limites plan)
```

La Phase 3 (intégration retrieve dans agent-service) est le **minimum viable** — elle seule change l'expérience utilisateur immédiatement.

---

## Risques

| Risque | Mitigation |
|--------|------------|
| Retrieval ralentit le chat (latence) | Timeout 800ms strict dans `MemoryClientService` + graceful degrade (contextBlock vide) |
| Extraction LLM coûteuse à chaque message | Extraction seulement si ≥ 6 messages dans la session + 1 extraction max par session |
| Souvenirs incorrects ou biaisés pollue le contexte | Score threshold 0.65 sur Qdrant + decay rapide si jamais accédé |
| Accumulation infinie de souvenirs | Limites par plan + decay + consolidation nocturne |
| Données PII dans les souvenirs | Contraintes prompt extraction + masquage emails/téléphones via regex avant stockage |
| Qdrant collection introuvable au premier lancement | `MemoryVectorClient` crée la collection à la demande si elle n'existe pas |

---

## Hors scope (v1)

- Mémoire partagée entre agents de la même organisation
- Mémoire cross-utilisateur pour les agents système
- Export/import de mémoire entre environnements
- Interface d'inspection du graphe de connaissances
- Mémoire structurée (Knowledge Graph) — vecteurs uniquement en v1
- Fine-tuning basé sur les souvenirs (v3)
