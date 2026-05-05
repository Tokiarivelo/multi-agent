# Workflow — Assistante RH Intelligente

> De la candidature à l'entretien planifié, en 4 minutes, sans intervention humaine.

---

## Aperçu

| Attribut | Valeur |
|----------|--------|
| Nom | Assistante RH Intelligente |
| Déclencheur | Email entrant (webhook) ou manuel |
| Nœuds | 13 |
| Durée estimée | < 4 min pour 200 candidatures |
| LLMs supportés | Claude, GPT-4, Gemini, Azure, Ollama |

---

## Services impliqués

```
email-mcp-service   port 3012   Lire / envoyer des emails (SMTP)
calendar-mcp-service port 3013  Google Calendar — créneaux + événements
orchestration-service           Moteur d'exécution du workflow
agent-service                   Analyse CV + rédaction d'emails
gateway-service                 Point d'entrée unique (auth + proxy)
```

---

## Flux du workflow

```
START
  └─► EMAIL READ         (email_read_inbox)
        └─► LOOP          (max 200 candidatures)
              └─► AGENT   CV Analyzer → score 0-100, synthèse, décision
                    └─► CONDITIONAL  score >= 70 ?
                          ├── OUI ──► AGENT Email Accept
                          │              └─► EMAIL SEND (confirmation)
                          │                    └─► CALENDAR find_slots
                          │                           └─► CALENDAR create_event
                          └── NON ─► CONDITIONAL  score < 40 ?
                                       ├── OUI ──► AGENT Email Reject
                                       │              └─► EMAIL SEND (refus)
                                       └── NON ──► PROMPT (validation RH humaine)
                                                     └─► EMAIL SEND (après décision)
                                                           └─► CALENDAR find_slots
                                                                  └─► CALENDAR create_event
WORKSPACE_WRITE  (rapport JSON)
END
```

---

## Nœuds et configuration

### Nœud 1 — START
```json
{ "type": "START", "config": {} }
```

---

### Nœud 2 — Email Reader
```json
{
  "type": "EMAIL",
  "customName": "Email Reader",
  "config": {
    "action": "read",
    "filter": "subject:candidature",
    "limit": 200
  }
}
```
**Outil utilisé :** `email_read_inbox`
**Output :** `{ emails: [ { from, subject, body, attachments } ] }`

---

### Nœud 3 — Boucle candidatures
```json
{
  "type": "LOOP",
  "customName": "Boucle Candidatures",
  "config": {
    "collection": "emails",
    "maxIterations": 200
  }
}
```

---

### Nœud 4 — CV Analyzer (Agent IA)
```json
{
  "type": "AGENT",
  "customName": "CV Analyzer",
  "config": {
    "agentId": "<id-agent-cv-analyzer>",
    "prompt": "Tu es un assistant RH expert. Analyse ce CV et cette lettre de motivation pour le poste suivant : {{jobDescription}}.\n\nRetourne un JSON strict avec ces champs :\n- score: number (0 à 100)\n- synthese: string[] (exactement 5 points clés)\n- decision: 'Accept' | 'Review' | 'Reject'\n- candidatName: string\n- candidatEmail: string\n- reasons: string (justification courte)"
  }
}
```
**Input :** email complet du candidat
**Output :** `{ score, synthese, decision, candidatName, candidatEmail, reasons }`

---

### Nœud 5 — Score Check (Conditionnel)
```json
{
  "type": "CONDITIONAL",
  "customName": "Score >= 70 ?",
  "config": {
    "condition": "{{score}} >= 70",
    "trueTarget": "node-accept",
    "falseTarget": "node-check-reject"
  }
}
```

---

### Nœud 6 — Email Accept (Agent)
```json
{
  "type": "AGENT",
  "customName": "Email Accept Writer",
  "config": {
    "agentId": "<id-agent-email-writer>",
    "prompt": "Rédige un email de confirmation d'entretien professionnel et chaleureux pour {{candidatName}}.\nMentionne que nous avons bien reçu sa candidature et que son profil nous intéresse.\nNe mentionne pas le score. Signe au nom de l'équipe RH."
  }
}
```

---

### Nœud 7 — Score < 40 (Conditionnel)
```json
{
  "type": "CONDITIONAL",
  "customName": "Score < 40 ?",
  "config": {
    "condition": "{{score}} < 40",
    "trueTarget": "node-reject",
    "falseTarget": "node-human-review"
  }
}
```

---

### Nœud 8 — Email Reject (Agent)
```json
{
  "type": "AGENT",
  "customName": "Email Reject Writer",
  "config": {
    "agentId": "<id-agent-email-writer>",
    "prompt": "Rédige un email de refus poli, respectueux et encourageant pour {{candidatName}}.\nRemercie-le pour sa candidature. Ne mentionne jamais le score ni les raisons précises."
  }
}
```

---

### Nœud 9 — Validation RH (PROMPT — pause humaine)
```json
{
  "type": "PROMPT",
  "customName": "Validation RH",
  "config": {
    "prompt": "Profil borderline (score {{score}}/100).\n\nSynthèse :\n{{synthese}}\n\nRaisons : {{reasons}}\n\nAccepter cet entretien ?"
  }
}
```
> Le workflow se met en **pause** et attend la réponse du RH via l'interface.

---

### Nœud 10 — Email Send
```json
{
  "type": "EMAIL",
  "customName": "Envoyer Email",
  "config": {
    "action": "send",
    "to": "{{candidatEmail}}",
    "subject": "Re: Votre candidature",
    "html": "{{emailDraft}}"
  }
}
```
**Outil utilisé :** `email_send`

---

### Nœud 11 — Trouver créneaux (Calendar)
```json
{
  "type": "CALENDAR",
  "customName": "Chercher créneaux",
  "config": {
    "action": "find_slots",
    "duration": 60,
    "count": 3,
    "calendarId": "primary"
  }
}
```
**Outil utilisé :** `calendar_find_free_slots`
**Output :** `{ slots: [ { start, end } ], count: 3 }`

---

### Nœud 12 — Créer entretien (Calendar)
```json
{
  "type": "CALENDAR",
  "customName": "Créer entretien",
  "config": {
    "action": "create_event",
    "title": "Entretien RH — {{candidatName}}",
    "description": "Candidature reçue le {{date}}.\nScore IA : {{score}}/100\n\nSynthèse : {{synthese}}",
    "startDateTime": "{{slots[0].start}}",
    "endDateTime": "{{slots[0].end}}",
    "attendees": "{{candidatEmail}},{{hrEmail}}",
    "calendarId": "primary"
  }
}
```
**Outil utilisé :** `calendar_create_event`

---

### Nœud 13 — Rapport RH
```json
{
  "type": "WORKSPACE_WRITE",
  "customName": "Rapport RH",
  "config": {
    "filePath": "rh/rapport_{{date}}.json",
    "content": "{{results}}"
  }
}
```

---

### Nœud 14 — END
```json
{ "type": "END", "config": {} }
```

---

## JSON complet du workflow (à importer)

```json
{
  "name": "Assistante RH Intelligente",
  "description": "Traitement automatique des candidatures de l'analyse CV à la planification d'entretien.",
  "definition": {
    "version": 1,
    "inputSchema": [
      { "key": "jobDescription", "type": "string", "required": true, "label": "Description du poste" },
      { "key": "hrEmail", "type": "string", "required": true, "label": "Email du RH" }
    ],
    "nodes": [
      { "id": "n1",  "type": "START",       "config": {} },
      { "id": "n2",  "type": "EMAIL",        "customName": "Email Reader",
        "config": { "action": "read", "filter": "subject:candidature", "limit": 200 } },
      { "id": "n3",  "type": "LOOP",         "customName": "Boucle Candidatures",
        "config": { "collection": "emails", "maxIterations": 200 } },
      { "id": "n4",  "type": "AGENT",        "customName": "CV Analyzer",
        "config": { "agentId": "__CV_ANALYZER_AGENT_ID__" } },
      { "id": "n5",  "type": "CONDITIONAL",  "customName": "Score >= 70 ?",
        "config": { "condition": "{{score}} >= 70" } },
      { "id": "n6",  "type": "AGENT",        "customName": "Email Accept Writer",
        "config": { "agentId": "__EMAIL_WRITER_AGENT_ID__" } },
      { "id": "n7",  "type": "CONDITIONAL",  "customName": "Score < 40 ?",
        "config": { "condition": "{{score}} < 40" } },
      { "id": "n8",  "type": "AGENT",        "customName": "Email Reject Writer",
        "config": { "agentId": "__EMAIL_WRITER_AGENT_ID__" } },
      { "id": "n9",  "type": "PROMPT",       "customName": "Validation RH",
        "config": { "prompt": "Profil borderline (score {{score}}/100). Accepter ?" } },
      { "id": "n10", "type": "EMAIL",        "customName": "Envoyer Email",
        "config": { "action": "send", "to": "{{candidatEmail}}", "subject": "Re: Votre candidature" } },
      { "id": "n11", "type": "CALENDAR",     "customName": "Chercher créneaux",
        "config": { "action": "find_slots", "duration": 60, "count": 3 } },
      { "id": "n12", "type": "CALENDAR",     "customName": "Créer entretien",
        "config": { "action": "create_event", "title": "Entretien RH — {{candidatName}}" } },
      { "id": "n13", "type": "WORKSPACE_WRITE", "customName": "Rapport RH",
        "config": { "filePath": "rh/rapport.json" } },
      { "id": "n14", "type": "END",          "config": {} }
    ],
    "edges": [
      { "id": "e1",  "source": "n1",  "target": "n2"  },
      { "id": "e2",  "source": "n2",  "target": "n3"  },
      { "id": "e3",  "source": "n3",  "target": "n4"  },
      { "id": "e4",  "source": "n4",  "target": "n5"  },
      { "id": "e5",  "source": "n5",  "target": "n6",  "condition": "true"  },
      { "id": "e6",  "source": "n5",  "target": "n7",  "condition": "false" },
      { "id": "e7",  "source": "n7",  "target": "n8",  "condition": "true"  },
      { "id": "e8",  "source": "n7",  "target": "n9",  "condition": "false" },
      { "id": "e9",  "source": "n6",  "target": "n10" },
      { "id": "e10", "source": "n8",  "target": "n10" },
      { "id": "e11", "source": "n9",  "target": "n10" },
      { "id": "e12", "source": "n10", "target": "n11" },
      { "id": "e13", "source": "n11", "target": "n12" },
      { "id": "e14", "source": "n12", "target": "n13" },
      { "id": "e15", "source": "n13", "target": "n14" }
    ]
  }
}
```

---

## Variables d'environnement requises

### email-mcp-service
```env
EMAIL_MCP_PORT=3012
SMTP_HOST=smtp.gmail.com          # ou smtp.office365.com pour Outlook
SMTP_PORT=587
SMTP_USER=rh@entreprise.com
SMTP_PASS=<app-password>          # Gmail : générer un mot de passe d'application
SMTP_FROM=rh@entreprise.com
```

> **Gmail** : activer "Authentification à deux facteurs" puis générer un mot de passe d'application
> sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

### calendar-mcp-service
```env
CALENDAR_MCP_PORT=3013
GOOGLE_CALENDAR_ID=primary

# Option A — OAuth (recommandé pour un compte utilisateur)
GOOGLE_OAUTH_CLIENT_ID=<client-id>.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=<secret>
GOOGLE_OAUTH_REFRESH_TOKEN=<refresh-token>

# Option B — Compte de service (recommandé pour production / serveur)
GOOGLE_CALENDAR_CREDENTIALS=<JSON du compte de service en une seule ligne>
```

#### Obtenir un refresh token OAuth (Option A)
```bash
# 1. Créer des credentials OAuth dans Google Cloud Console
#    → APIs & Services → Credentials → OAuth 2.0 Client IDs (type: Desktop)

# 2. Utiliser oauth2l ou la Playground pour obtenir le refresh token :
#    https://developers.google.com/oauthplayground
#    Scope requis : https://www.googleapis.com/auth/calendar
```

#### Compte de service (Option B)
```bash
# 1. Google Cloud Console → IAM → Comptes de service → Créer
# 2. Télécharger le JSON des credentials
# 3. Dans Google Calendar → Paramètres → Partager avec le compte de service (email @...iam.gserviceaccount.com)
# 4. Coller le JSON minifié dans GOOGLE_CALENDAR_CREDENTIALS
```

---

## Outils MCP disponibles

### email-mcp-service (port 3012)

| Outil | Description |
|-------|-------------|
| `email_send` | Envoie un email (plain text ou HTML) via SMTP |
| `email_send_template` | Envoie avec template `{{variable}}` |
| `email_verify_smtp` | Vérifie la connexion SMTP avant envoi |

**Exemple d'appel direct :**
```bash
curl -X POST http://localhost:3012/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "email_send",
      "arguments": {
        "to": "candidat@example.com",
        "subject": "Confirmation de votre candidature",
        "body": "Bonjour, nous avons bien reçu votre candidature..."
      }
    }
  }'
```

### calendar-mcp-service (port 3013)

| Outil | Description |
|-------|-------------|
| `calendar_create_event` | Crée un événement avec participants |
| `calendar_list_events` | Liste les événements à venir |
| `calendar_find_free_slots` | Trouve N créneaux libres de N minutes |
| `calendar_update_event` | Met à jour un événement existant |
| `calendar_delete_event` | Supprime un événement |

**Exemple — trouver 3 créneaux d'1 heure :**
```bash
curl -X POST http://localhost:3013/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "calendar_find_free_slots",
      "arguments": { "duration": "60", "count": "3" }
    }
  }'
```

---

## Démarrage des services

```bash
# Installer les dépendances
pnpm --filter @multi-agent/email-mcp-service install
pnpm --filter @multi-agent/calendar-mcp-service install

# Démarrer en développement
pnpm --filter @multi-agent/email-mcp-service dev
pnpm --filter @multi-agent/calendar-mcp-service dev

# Vérifier les health checks
curl http://localhost:3012/api/mcp/health
curl http://localhost:3013/api/mcp/health
```

---

## Ajout au pnpm workspace

Ajouter dans `pnpm-workspace.yaml` si pas encore présent :
```yaml
packages:
  - 'services/*'
  - 'packages/*'
  - 'frontend'
```

---

## Fichiers modifiés / créés

### Nouveaux services
```
services/email-mcp-service/
├── package.json
├── tsconfig.json
└── src/
    ├── app.module.ts
    ├── main.ts
    ├── domain/email-tool.interface.ts
    ├── infrastructure/
    │   ├── config/configuration.ts
    │   ├── config/env.validation.ts
    │   └── email/email-api.service.ts
    └── presentation/
        ├── controllers/mcp.controller.ts
        └── tools/
            ├── index.ts
            ├── send-email.tool.ts
            ├── send-email-template.tool.ts
            └── verify-smtp.tool.ts

services/calendar-mcp-service/
├── package.json
├── tsconfig.json
└── src/
    ├── app.module.ts
    ├── main.ts
    ├── domain/calendar-tool.interface.ts
    ├── infrastructure/
    │   ├── config/configuration.ts
    │   ├── config/env.validation.ts
    │   └── calendar/calendar-api.service.ts
    └── presentation/
        ├── controllers/mcp.controller.ts
        └── tools/
            ├── index.ts
            ├── create-event.tool.ts
            ├── list-events.tool.ts
            ├── find-free-slots.tool.ts
            ├── update-event.tool.ts
            └── delete-event.tool.ts
```

### Fichiers modifiés
```
services/orchestration-service/src/domain/entities/workflow.entity.ts
  → Ajout: EMAIL = 'EMAIL', CALENDAR = 'CALENDAR' dans NodeType

services/orchestration-service/src/infrastructure/external/workflow-executor.service.ts
  → Ajout: case NodeType.EMAIL et case NodeType.CALENDAR dans executeNodeByType()

services/gateway-service/src/infrastructure/config/env.validation.ts
  → Ajout: EMAIL_MCP_SERVICE_URL, CALENDAR_MCP_SERVICE_URL

services/gateway-service/src/presentation/controllers/proxy.controller.ts
  → Ajout: routes 'email/*' et 'calendar/*' + cases dans router + validation switch
```

---

## Impact attendu

| Métrique | Avant | Après |
|----------|-------|-------|
| Temps traitement 200 CVs | 2 jours | < 4 minutes |
| Taux de réponse aux candidats | ~60 % | 100 % |
| Entretiens planifiés automatiquement | 0 % | 85 %+ |
| Coût humain par campagne | 16h RH | 15 min (supervision) |

---

*Généré le 2026-05-04 — Multi-Agent Platform*
