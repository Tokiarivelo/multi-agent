# Plan d'implémentation — Audit Logs RGPD & Export

## Objectif

Fournir un journal d'audit immuable, conforme RGPD, requis par les clients finance (rétention 7 ans, traçabilité SOX) et santé (traçabilité accès aux données PHI, anonymisation). Inclut : collecte centralisée via NATS, stockage inviolable avec chaînage de hash, exports CSV/JSON/PDF, droits RGPD (accès, effacement par pseudonymisation), politiques de rétention configurables.

---

## Contexte existant

- `WorkflowChangeLog` : journal partiel des modifications de workflows (≠ audit général)
- `ExecutionLog` : logs d'exécution techniques, non RGPD
- NATS opérationnel dans tous les services — pattern `emit-and-forget` déjà utilisé
- Aucun système de rétention, aucun droit RGPD implémenté
- Ports libres : 3017 (audit-service), 3018 (réservé)
- Plan enterprise (plan-sso-enterprise.md) : `AUDIT_LOGS` est une `EnterpriseFeature`

---

## Périmètre des événements à capturer

| Catégorie        | Exemples d'événements                                              |
|------------------|--------------------------------------------------------------------|
| **Auth**         | login, logout, échec login (×5 → alerte), MFA, reset password, SSO |
| **Utilisateurs** | création, MAJ profil, changement rôle, suspension, suppression     |
| **Workflows**    | création, exécution, suppression, partage, fork, changement visibilité |
| **Agents**       | création, suppression, modification système prompt                 |
| **Données**      | upload fichier, téléchargement, suppression, accès vectoriel       |
| **API Keys**     | création, révocation, utilisation anormale (> seuil/heure)         |
| **Admin**        | changement config plateforme, activation contrat enterprise         |
| **SSO**          | login SSO, provisioning JIT, échec assertion SAML                  |
| **RGPD**         | DSAR soumise, effacement déclenché, export données personnelles     |

---

## Sujets NATS — convention

```
audit.<service>.<action>
```

| Sujet NATS                    | Émis par              |
|-------------------------------|-----------------------|
| `audit.auth.login`            | gateway-service       |
| `audit.auth.login_failed`     | gateway-service       |
| `audit.auth.logout`           | gateway-service       |
| `audit.auth.sso_login`        | sso-service           |
| `audit.auth.sso_failure`      | sso-service           |
| `audit.user.created`          | gateway-service       |
| `audit.user.role_changed`     | gateway-service       |
| `audit.user.deleted`          | gateway-service       |
| `audit.workflow.executed`     | orchestration-service |
| `audit.workflow.deleted`      | orchestration-service |
| `audit.workflow.shared`       | orchestration-service |
| `audit.agent.created`         | agent-service         |
| `audit.agent.deleted`         | agent-service         |
| `audit.file.uploaded`         | file-service          |
| `audit.file.downloaded`       | file-service          |
| `audit.file.deleted`          | file-service          |
| `audit.apikey.created`        | gateway-service       |
| `audit.apikey.revoked`        | gateway-service       |
| `audit.enterprise.activated`  | enterprise-service    |
| `audit.gdpr.dsar_submitted`   | audit-service         |
| `audit.gdpr.erasure_executed` | audit-service         |

---

## Architecture cible

```
[Tous les services]
  └── NatsClient.publish('audit.*', AuditEventDto)

[audit-service :3017]
  ├── NATS subscriber  → persist → AuditLog (append-only)
  ├── GET /audit/logs  → query avec filtres + pagination
  ├── POST /audit/export → génère fichier CSV/JSON/PDF
  ├── POST /audit/gdpr/dsar → déclenche export DSAR
  ├── POST /audit/gdpr/erase → pseudonymisation utilisateur
  └── Cron retention → archive / purge selon DataRetentionPolicy

[gateway-service :3000]
  └── /api/audit/* → proxy → audit-service

[Frontend]
  ├── /admin/audit    → tableau de bord audit (ADMIN)
  └── /settings/privacy → droits RGPD (utilisateur)
```

---

## Phase 1 — Base de données

### 1. `packages/database/prisma/schema.prisma`

**Nouveaux modèles :**

```prisma
model AuditLog {
  id            String        @id @default(uuid())
  // Séquence globale (détection de trou = falsification)
  sequence      BigInt        @unique @default(autoincrement())
  // Chaînage de hash : sha256(prev_hash + payload)
  hash          String        // SHA-256
  prevHash      String?       // null pour le premier enregistrement
  // Qui
  actorId       String?       // userId (null si action système)
  actorEmail    String?       // dénormalisé pour lisibilité des exports
  actorIp       String?
  actorUserAgent String?
  // Quoi
  action        String        // ex: "workflow.executed"
  category      AuditCategory
  severity      AuditSeverity @default(INFO)
  // Sur quoi
  resourceType  String?       // "Workflow" | "User" | "Agent" | ...
  resourceId    String?
  resourceName  String?       // dénormalisé
  // Contexte
  orgId         String?
  serviceOrigin String        // ex: "orchestration-service"
  payload       Json          // données métier structurées
  // Conformité
  dataClassification DataClassification @default(INTERNAL)
  retentionCategory  RetentionCategory  @default(STANDARD)
  // Timestamps (immuable — jamais de UPDATE sur cette table)
  occurredAt    DateTime      // horodatage de l'événement source
  recordedAt    DateTime      @default(now())

  @@index([actorId])
  @@index([action])
  @@index([category])
  @@index([resourceType, resourceId])
  @@index([orgId])
  @@index([occurredAt])
  @@index([retentionCategory])
  @@map("audit_logs")
}

enum AuditCategory {
  AUTH
  USER_MANAGEMENT
  WORKFLOW
  AGENT
  DATA_ACCESS
  API_KEY
  ADMIN
  SSO
  GDPR
  SECURITY
}

enum AuditSeverity  { INFO WARNING CRITICAL }

enum DataClassification {
  PUBLIC
  INTERNAL
  CONFIDENTIAL
  PHI           // Protected Health Information (santé)
  PCI           // Payment Card Industry (finance)
}

enum RetentionCategory {
  STANDARD      // 90 jours
  COMPLIANCE    // 3 ans (RGPD)
  FINANCIAL     // 7 ans (obligation comptable française)
  MEDICAL       // 10 ans (dossier médical)
  PERMANENT     // jamais effacé (sécurité critique)
}

model DataRetentionPolicy {
  id               String            @id @default(uuid())
  orgId            String?           // null = politique globale plateforme
  retentionCategory RetentionCategory @unique
  retentionDays    Int               // -1 = permanent
  archiveAfterDays Int?              // déplace vers cold storage avant purge
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@map("data_retention_policies")
}

model DsarRequest {
  id            String      @id @default(uuid())
  requesterId   String      // userId demandeur
  targetUserId  String      // userId concerné (souvent identique)
  type          DsarType
  status        DsarStatus  @default(PENDING)
  exportFileKey String?     // S3/MinIO key du fichier d'export
  exportExpiry  DateTime?   // lien valide 7 jours
  submittedAt   DateTime    @default(now())
  processedAt   DateTime?
  completedAt   DateTime?
  notes         String?

  @@index([requesterId])
  @@index([targetUserId])
  @@index([status])
  @@map("dsar_requests")
}

enum DsarType   { ACCESS ERASURE PORTABILITY RECTIFICATION }
enum DsarStatus { PENDING PROCESSING COMPLETED REJECTED EXPIRED }

model PseudonymizationRecord {
  id           String   @id @default(uuid())
  originalHash String   @unique  // sha256(originalEmail) — pour détecter doublon
  pseudonym    String   @unique  // "user_<cuid>" utilisé dans les audit logs
  erasedAt     DateTime @default(now())
  // Note : originalEmail n'est jamais stocké ici

  @@map("pseudonymization_records")
}
```

**Politique d'accès DB (CRITICAL) :**
- Rôle PostgreSQL `audit_writer` : INSERT uniquement sur `audit_logs`
- Rôle PostgreSQL `audit_reader` : SELECT uniquement sur `audit_logs`
- Aucun UPDATE, aucun DELETE autorisé via Prisma sur `AuditLog`

---

## Phase 2 — audit-service (nouveau microservice)

> Scaffolder avec `/create-service audit 3017 "Journal d'audit immuable RGPD et export"`

### 2. Structure

```
services/audit-service/src/
├── domain/
│   ├── entities/audit-log.entity.ts
│   ├── entities/dsar-request.entity.ts
│   └── services/
│       ├── hash-chain.service.ts       # SHA-256 chaîné
│       ├── audit-writer.service.ts     # persist append-only
│       ├── audit-query.service.ts      # filtres, pagination, search
│       ├── retention.service.ts        # politique de rétention
│       └── pseudonymization.service.ts # droit à l'effacement RGPD
├── application/
│   ├── use-cases/
│   │   ├── record-audit-event.use-case.ts
│   │   ├── query-audit-logs.use-case.ts
│   │   ├── export-audit-logs.use-case.ts
│   │   ├── submit-dsar.use-case.ts
│   │   ├── process-erasure.use-case.ts
│   │   └── enforce-retention.use-case.ts
│   └── dto/
│       ├── audit-event.dto.ts          # payload NATS entrant
│       ├── audit-query.dto.ts          # filtres API
│       └── export-request.dto.ts
├── infrastructure/
│   ├── nats/audit-event.consumer.ts   # souscrit à audit.>
│   ├── export/
│   │   ├── csv-exporter.service.ts
│   │   ├── json-exporter.service.ts
│   │   └── pdf-exporter.service.ts    # pdfmake ou puppeteer
│   ├── storage/export-storage.service.ts  # MinIO/S3 pour les fichiers DSAR
│   └── cron/retention-enforcer.cron.ts   # @Cron('0 2 * * *')
└── presentation/
    ├── controllers/
    │   ├── audit-logs.controller.ts
    │   ├── export.controller.ts
    │   └── gdpr.controller.ts
    └── guards/audit-admin.guard.ts
```

### 3. `domain/services/hash-chain.service.ts`

```typescript
// compute(prevHash: string | null, payload: object): string
//   → sha256(JSON.stringify({ prevHash, payload }))
// verify(log: AuditLog, prevLog: AuditLog | null): boolean
//   → recompute et compare avec log.hash
// verifyChain(logs: AuditLog[]): { valid: boolean; brokenAt?: BigInt }
```

### 4. `domain/services/audit-writer.service.ts`

```typescript
// Règle : JAMAIS de db.auditLog.update() ni delete()
// Séquence : récupère le dernier hash en DB (SELECT MAX(sequence))
// Calcule le nouveau hash, insère atomiquement
// Émet NATS 'audit.security.tamper_detected' si vérification échoue
```

### 5. `domain/services/pseudonymization.service.ts`

```typescript
// replaceUserReferences(userId: string): Promise<void>
//   1. Génère pseudonym = 'user_' + cuid()
//   2. Stocke sha256(email) → pseudonym dans PseudonymizationRecord
//   3. UPDATE audit_logs SET actorEmail = pseudonym WHERE actorId = userId
//      (seule UPDATE autorisée sur audit_logs — champ non-métier)
//   4. Efface les données PII dans users, executions, files (cascade)
//   5. Enregistre audit log 'gdpr.erasure_executed' avec pseudonym
// Note : actorId est conservé comme pseudonym pour maintenir la traçabilité
```

### 6. `infrastructure/nats/audit-event.consumer.ts`

```typescript
// Souscrit sur 'audit.>' (wildcard NATS)
// Valide AuditEventDto via Zod
// Appelle record-audit-event.use-case
// En cas d'échec : publie sur 'audit.dlq' (dead letter queue)
// Ne rejette JAMAIS un message — log l'erreur et continue
```

### 7. `application/dto/audit-event.dto.ts`

```typescript
const AuditEventSchema = z.object({
  action: z.string().min(3).max(100),          // ex: "workflow.executed"
  category: z.nativeEnum(AuditCategory),
  severity: z.nativeEnum(AuditSeverity).default('INFO'),
  actorId: z.string().uuid().optional(),
  actorEmail: z.string().email().optional(),
  actorIp: z.string().ip().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  resourceName: z.string().optional(),
  orgId: z.string().optional(),
  serviceOrigin: z.string(),
  payload: z.record(z.unknown()),
  dataClassification: z.nativeEnum(DataClassification).default('INTERNAL'),
  retentionCategory: z.nativeEnum(RetentionCategory).default('STANDARD'),
  occurredAt: z.string().datetime(),
})
```

### 8. `presentation/controllers/audit-logs.controller.ts`

```
GET  /audit/logs
  ?category=AUTH&severity=CRITICAL
  &actorId=<uuid>&resourceType=Workflow
  &from=2025-01-01&to=2025-12-31
  &orgId=<uuid>&page=1&limit=50
  → AuditLogPage { items[], total, page, hasNext }

GET  /audit/logs/:id          → détail avec vérification hash
GET  /audit/logs/verify-chain → vérifie intégrité complète (ADMIN)
```

### 9. `presentation/controllers/export.controller.ts`

```
POST /audit/export
  Body: { format: 'csv'|'json'|'pdf', filters: AuditQueryDto }
  → { jobId, estimatedRows } (async)

GET  /audit/export/:jobId/status → { status, downloadUrl?, expiresAt? }
GET  /audit/export/:jobId/download → stream fichier
```

### 10. `presentation/controllers/gdpr.controller.ts`

```
POST /audit/gdpr/dsar
  Body: { type: DsarType, targetUserId }
  → DsarRequest créée, traitement asynchrone

GET  /audit/gdpr/dsar/:id → statut + downloadUrl si prêt

POST /audit/gdpr/erase/:userId
  → pseudonymisation + cascade, ADMIN seulement
  → log 'gdpr.erasure_executed'

GET  /audit/gdpr/retention-policies → liste des politiques actives
PUT  /audit/gdpr/retention-policies/:category → MAJ durée (ADMIN)
```

---

## Phase 3 — Instrumentation des services existants

### 11. Helper partagé `packages/audit-client/`

Évite de dupliquer la logique d'émission dans chaque service :

```typescript
// packages/audit-client/src/audit.client.ts
export class AuditClient {
  constructor(private readonly nats: NatsClient) {}

  emit(event: Omit<AuditEventDto, 'serviceOrigin' | 'occurredAt'>): void {
    // Ne lève jamais d'exception — fire-and-forget
    void this.nats.publish(`audit.${event.category.toLowerCase()}.${event.action}`, {
      ...event,
      occurredAt: new Date().toISOString(),
    }).catch(err => logger.warn('Audit emit failed', err))
  }
}
```

### 12. `services/gateway-service` — Auth events

```typescript
// Dans login.use-case.ts — après succès :
this.audit.emit({ action: 'login', category: 'AUTH', actorId: user.id,
  actorEmail: user.email, actorIp: req.ip, serviceOrigin: 'gateway-service',
  payload: { provider: 'credentials' }, retentionCategory: 'COMPLIANCE' })

// Après échec (5 tentatives) → severity: 'CRITICAL', category: 'SECURITY'
// action: 'login_failed_brute_force'
```

### 13. `services/orchestration-service` — Workflow events

```typescript
// Dans workflow-executor.service.ts — après chaque exécution :
this.audit.emit({ action: 'workflow.executed', category: 'WORKFLOW',
  actorId: execution.userId, resourceType: 'Workflow',
  resourceId: execution.workflowId, serviceOrigin: 'orchestration-service',
  payload: { status: result.status, durationMs: result.duration },
  retentionCategory: 'STANDARD' })
```

### 14. `services/file-service` — Data access events (PHI/PCI)

```typescript
// Sur download fichier :
this.audit.emit({ action: 'file.downloaded', category: 'DATA_ACCESS',
  dataClassification: 'PHI',  // ← si org santé détectée via contractTier
  retentionCategory: 'MEDICAL',
  payload: { fileName, fileSize, mimeType } })
```

### 15. `services/agent-service` — Agent lifecycle

```typescript
// Création / suppression agent :
this.audit.emit({ action: 'agent.created', category: 'AGENT',
  payload: { agentName, modelId, toolCount: tools.length } })
```

---

## Phase 4 — Gateway (modifications)

### 16. `infrastructure/config/env.validation.ts`

```typescript
AUDIT_SERVICE_URL: z.string().url().default('http://localhost:3017'),
```

### 17. `presentation/controllers/proxy.controller.ts`

```typescript
case 'audit':
  return this.proxyTo(this.auditServiceUrl, path, req);
```

### 18. `presentation/middleware/audit-http.middleware.ts` *(nouveau)*

```typescript
// Middleware global : émet 'audit.auth.api_call' pour chaque requête authentifiée
// Capture : method, path normalisé, statusCode, durationMs, actorId
// Exclut : GET /health, GET /metrics, assets statiques
// Permet de détecter des accès API anormaux (taux élevé, heure inhabituelle)
```

---

## Phase 5 — Frontend

### 19. `frontend/src/features/audit/` *(nouveau)*

```
features/audit/
├── components/
│   ├── AuditLogTable.tsx         # tableau paginé avec filtres
│   ├── AuditLogFilters.tsx       # category, severity, date range, actor
│   ├── AuditLogDetail.tsx        # détail JSON + hash validity badge
│   ├── ExportModal.tsx           # choix format + filtres + bouton download
│   └── HashValidityBadge.tsx     # vert OK / rouge TAMPERED
├── hooks/
│   ├── useAuditLogs.ts
│   └── useAuditExport.ts
└── index.ts
```

### 20. `frontend/src/app/(admin)/audit/page.tsx` *(nouveau)*

- Accès : ADMIN plateforme + feature `AUDIT_LOGS` débloquée (Enterprise)
- Affiche `AuditLogTable` avec `AuditLogFilters`
- Bouton "Vérifier l'intégrité de la chaîne" → appelle `/audit/logs/verify-chain`
- Bouton "Exporter" → ouvre `ExportModal`

### 21. `frontend/src/features/gdpr/` *(nouveau)*

```
features/gdpr/
├── components/
│   ├── DsarRequestForm.tsx       # formulaire droit d'accès / effacement
│   ├── DsarRequestStatus.tsx     # suivi de la demande en cours
│   └── RetentionPoliciesTable.tsx # ADMIN: durées par catégorie
└── index.ts
```

### 22. `frontend/src/app/(app)/settings/privacy/page.tsx` *(nouveau)*

- Accès : tout utilisateur connecté
- Sections : "Mes données" (DSAR accès) · "Supprimer mon compte" (DSAR effacement)
- Affiche l'état de la demande en cours si existante

### 23. Locales

```
frontend/src/locales/en/audit.ts
frontend/src/locales/fr/audit.ts
frontend/src/locales/en/gdpr.ts
frontend/src/locales/fr/gdpr.ts
```

Enregistrer dans `src/locales/{en,fr}/index.ts`.

---

## Phase 6 — Rétention & conformité sectorielle

### 24. `infrastructure/cron/retention-enforcer.cron.ts`

```typescript
@Cron('0 2 * * *')  // 2h du matin chaque nuit
async enforceRetention(): Promise<void> {
  // Pour chaque RetentionCategory :
  //   1. Archive (cold storage) les logs > archiveAfterDays
  //   2. Purge les logs > retentionDays (sauf PERMANENT)
  //   3. Émet audit log 'gdpr.retention_enforced' avec stats
}
```

**Politiques par défaut :**

| Catégorie          | Archive après | Purge après | Secteur cible        |
|--------------------|--------------|-------------|----------------------|
| `STANDARD`         | —            | 90 j        | Tous                 |
| `COMPLIANCE`       | 1 an         | 3 ans       | Tous (RGPD)          |
| `FINANCIAL`        | 2 ans        | 7 ans       | Finance (L123-22 C.com) |
| `MEDICAL`          | 5 ans        | 10 ans      | Santé (R1112-1 CSP)  |
| `PERMANENT`        | jamais       | jamais      | Sécurité critique    |

### 25. Finance — Exigences spécifiques SOX / DSP2

- `retentionCategory: 'FINANCIAL'` obligatoire sur : paiements, API keys financières, accès aux données de facturation
- Champ `payload.nonRepudiation: true` sur les actions irréversibles (suppression, export)
- Export format XBRL sur demande (hors scope v1 — prévu v2)
- Alert `severity: 'CRITICAL'` + notification email immédiate sur accès `PCI` en dehors des heures ouvrées

### 26. Santé — Exigences spécifiques HDS (Hébergeur Données Santé)

- `dataClassification: 'PHI'` obligatoire sur tout accès fichier dans les orgs santé
- `retentionCategory: 'MEDICAL'` par défaut pour les orgs certifiées HDS
- Champ `payload.purposeOfAccess` obligatoire (Zod `.min(1)`) sur events `DATA_ACCESS` + PHI
- Aucune donnée PHI dans `payload` des audit logs (seulement les identifiants, jamais le contenu)
- Pseudo-anonymisation des audit logs PHI après 5 ans (avant purge à 10 ans)

### 27. Vérification d'intégrité

```typescript
// GET /audit/logs/verify-chain
// Relit les N derniers logs ordonnés par sequence
// Recompute sha256 pour chaque entrée et compare
// Retourne : { valid: true } ou { valid: false, brokenAt: sequence, gap?: boolean }
// Gap = sequence non contiguë → enregistrement supprimé en DB directement
```

---

## Séquencement recommandé

```
Phase 1 (DB)
  → Phase 2 (audit-service cœur)       parallèle →  Phase 3 (instrumentation)
      → Phase 4 (gateway proxy)
          → Phase 5 (frontend)
              → Phase 6 (rétention + conformité sectorielle)
```

Phases 2 et 3 sont **parallélisables** une fois la Phase 1 terminée.

---

## Risques

| Risque | Mitigation |
|--------|------------|
| Volume NATS très élevé (milliers d'events/min) | Batch insert Prisma en micro-lot de 50 messages — évite N×INSERT |
| Suppression directe en DB contourne l'immutabilité | Rôle PostgreSQL `audit_writer` : INSERT only, jamais DELETE — vérifier à chaque migration |
| Export DSAR bloque le thread sur gros volume | Export asynchrone via jobId + polling; stream S3 sur download |
| Données PHI dans `payload` accidentellement | Validation Zod + liste noire de champs (`content`, `body`, `text`) dans `audit-event.dto.ts` |
| Rétention FINANCIAL mal configurée → infraction légale | Politique FINANCIAL seul l'ADMIN plateforme peut la raccourcir, jamais en dessous de 7 ans |
| Pseudonymisation brise les dashboards analytiques | Pseudonym stable par user → les agrégats par acteur restent cohérents après effacement |

---

## Hors scope (v1)

- Signature cryptographique des exports (non-répudiation avancée — v2)
- Streaming temps réel des audit logs vers SIEM externe (Splunk, Datadog)
- Export XBRL pour finance
- Interface de déclaration de violation (Article 33 RGPD) — bilan manuel en v1
- SCIM-based audit log forwarding vers IdP enterprise
