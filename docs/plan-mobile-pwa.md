# Application Mobile — PWA (Phase 1)
> Condition de lancement : **Expansion usage** — activer quand la base d'utilisateurs actifs dépasse 500 utilisateurs ou sur décision commerciale d'entrée terrain

---

## Objectif
Rendre la plateforme multi-agent utilisable sur mobile sans app store : PWA installable, expérience native-like, fonctionnalités essentielles (monitoring d'exécutions, approbations, notifications push).

---

## Contexte & Périmètre

### Ce que la PWA couvre (MVP)
- Tableau de bord : statut des workflows en temps réel
- Exécutions : liste, détail, logs, actions (pause / relancer / annuler)
- Approbations humaines : approuver / rejeter depuis mobile
- Notifications push : alertes d'exécution, échecs, demandes d'approbation
- Authentification : login / session persistante

### Ce qui reste desktop-only (hors scope v1)
- Éditeur visuel de workflow (canvas drag-and-drop)
- Marketplace avancé
- Configuration des intégrations et des agents

---

## Phase 1 — Fondations PWA (Semaine 1–2)

### 1. Manifest & Service Worker — `frontend/public/`

```
frontend/public/
├── manifest.json          # PWA manifest (nom, icônes, thème, display: standalone)
├── icons/
│   ├── icon-192x192.png
│   ├── icon-512x512.png
│   └── icon-maskable-512x512.png
└── sw.js                  # Service worker (cache, offline, push)
```

**`manifest.json`**
```json
{
  "name": "Multi-Agent Platform",
  "short_name": "MultiAgent",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#6366f1",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**`_document.tsx` — `frontend/src/pages/_document.tsx`**
Ajouter `<link rel="manifest">`, `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-capable">`.

---

### 2. Service Worker (Workbox) — `frontend/src/lib/service-worker/`

| Fichier | Rôle |
|---|---|
| `sw-config.ts` | Config Workbox : stratégies de cache par route |
| `push-handler.ts` | Réception et affichage des notifications push |
| `offline-fallback.ts` | Page `/offline` quand hors réseau |

Stratégies :
- API calls (`/api/*`) → **NetworkFirst** (fallback cache 5 min)
- Assets statiques → **CacheFirst** (long TTL)
- Pages shell → **StaleWhileRevalidate**

Installation via `next-pwa` ou plugin Vite custom selon build setup.

---

### 3. Layout mobile responsive — `frontend/src/components/layout/`

Modifier `AppLayout` pour :
- Bottom navigation bar sur `sm` (Accueil, Exécutions, Notifications, Profil)
- Sidebar rétractée / drawer sur mobile
- Safe-area insets (`env(safe-area-inset-*)`) pour iPhone notch

Fichiers impactés :
- `AppLayout.tsx` — détection `useIsMobile()` hook
- `Sidebar.tsx` — mode drawer sur mobile
- `MobileBottomNav.tsx` — nouveau composant (< 150 lignes)

Règle : aucun breakpoint `md:hidden` dans les composants existants — wrapper dans `AppLayout`.

---

### 4. Hook `useIsMobile` — `frontend/src/hooks/use-is-mobile.ts`

```typescript
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}
```

---

## Phase 2 — Notifications Push (Semaine 2–3)

### 5. Backend : Push Service — `services/notification-service/`

| Fichier | Rôle |
|---|---|
| `push-subscription.entity.ts` | Entité Prisma : userId, endpoint, keys (p256dh, auth), userAgent |
| `save-push-subscription.use-case.ts` | Enregistrer/mettre à jour un abonnement push |
| `send-push-notification.use-case.ts` | Envoyer via `web-push` (VAPID) |
| `push.controller.ts` | `POST /push/subscribe`, `DELETE /push/unsubscribe` |

**Schéma Prisma — `packages/database/prisma/schema.prisma`**
```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

Migration : `pnpm prisma migrate dev --name add_push_subscriptions`

---

### 6. Frontend : abonnement push — `frontend/src/features/notifications/`

| Fichier | Rôle |
|---|---|
| `use-push-subscription.ts` | Hook : demande permission, souscrit au SW, POST vers API |
| `PushOptIn.tsx` | Bannière d'opt-in (affiché une seule fois) |
| `push.api.ts` | Appels `POST /api/notifications/push/subscribe` |

Flow :
1. À la première connexion mobile → afficher `PushOptIn`
2. Utilisateur accepte → `Notification.requestPermission()`
3. Obtenir `PushSubscription` via `navigator.serviceWorker.ready`
4. POST vers gateway → notification-service enregistre

---

### 7. Gateway proxy — `services/gateway-service/src/infrastructure/`

Ajouter case dans `proxy.controller.ts` :
```typescript
case 'notifications':
  return this.proxyService.forward(req, res, this.config.NOTIFICATION_SERVICE_URL)
```

Ajouter `NOTIFICATION_SERVICE_URL` dans `env.validation.ts`.

---

### 8. Triggers push — `services/orchestration-service/`

Émettre un event NATS `push.notification.send` dans :
- `complete-execution.use-case.ts` — exécution terminée
- `fail-execution.use-case.ts` — exécution échouée
- `request-human-approval.use-case.ts` — approbation requise

`notification-service` souscrit à `push.notification.send` et dispatche vers `web-push`.

---

## Phase 3 — Expérience Mobile Optimisée (Semaine 3–4)

### 9. Pages mobile-first — `frontend/src/features/`

**Exécutions (mobile)**
- `ExecutionListMobile.tsx` — cards scrollables, pull-to-refresh (`react-pull-to-refresh`)
- `ExecutionDetailMobile.tsx` — logs en accordéon, actions en bottom sheet
- `ApprovalRequestMobile.tsx` — approve/reject avec confirmation haptic feedback

**Dashboard (mobile)**
- `DashboardMobile.tsx` — métriques clés en 2 colonnes, sparklines minimalistes
- Widget "En attente d'approbation" épinglé en haut si count > 0

Règle composant : chaque fichier < 150 lignes, décomposer si dépassé.

---

### 10. Offline UX — `frontend/src/features/offline/`

| Fichier | Rôle |
|---|---|
| `OfflineBanner.tsx` | Bandeau "Mode hors ligne — données en cache" |
| `use-network-status.ts` | Hook `navigator.onLine` + event listener |
| `offline.page.tsx` | Page fallback servie par SW |

Actions désactivées hors ligne : exécuter un workflow, modifier config. Lecture seule uniquement.

---

### 11. i18n mobile — `frontend/src/locales/{en,fr}/mobile.ts`

Toutes les nouvelles chaînes UI dans les fichiers de traduction :

```typescript
// en/mobile.ts
export const mobile = {
  pwa: {
    installBanner: 'Install the app for the best experience',
    installButton: 'Install',
    dismissButton: 'Not now',
  },
  push: {
    optInTitle: 'Stay informed',
    optInDescription: 'Receive alerts for workflow completions and approvals',
    enable: 'Enable notifications',
    skip: 'Skip',
  },
  offline: {
    banner: 'Offline — showing cached data',
    pageTitle: 'No connection',
    pageDescription: 'Check your network and try again',
  },
}
```

Ajouter dans `en/index.ts` et `fr/index.ts`.

---

## Phase 4 — Install Prompt & Analytics (Semaine 4)

### 12. Install Prompt — `frontend/src/features/pwa/`

| Fichier | Rôle |
|---|---|
| `use-pwa-install.ts` | Capture `beforeinstallprompt`, expose `promptInstall()` |
| `InstallBanner.tsx` | Bannière bottom-sheet avec CTA "Installer l'app" |
| `InstallInstructions.tsx` | Guide iOS (Add to Home Screen) — affiché si Safari |

Conditions d'affichage :
- PWA non déjà installée (`window.matchMedia('(display-mode: standalone)')` → false)
- 2e visite ou plus (stocké `localStorage`)
- Pas déjà refusé (stocké `localStorage` avec TTL 7 jours)

---

### 13. Métriques PWA — `services/analytics-service/`

Tracker les events :
- `pwa.install_prompt_shown`
- `pwa.installed`
- `pwa.push_opted_in`
- `pwa.offline_fallback_served`
- `pwa.push_notification_clicked`

Via le bus NATS existant (`analytics.event.track`).

---

## Risques & Mitigations

| Risque | Mitigation |
|---|---|
| iOS : push notifications non supportées avant iOS 16.4 | Détecter et afficher message alternatif ; pas de promesse push sur iOS < 16.4 |
| Service Worker cache stale | Versioning du SW (`CACHE_VERSION`) + `skipWaiting()` + `clientsClaim()` |
| VAPID keys en clair | Stocker dans les secrets K8s, jamais dans `.env` committé |
| Breakpoints cassent desktop | Tests visuels Playwright sur viewport 1280×800 avant merge |
| Pull-to-refresh interfère avec scroll | Désactiver sur les listes avec scroll horizontal |

---

## Dépendances

```bash
# Frontend
pnpm --filter frontend add next-pwa workbox-window web-push
pnpm --filter frontend add -D @types/web-push

# Backend (notification-service)
pnpm --filter @multi-agent/notification-service add web-push
pnpm --filter @multi-agent/notification-service add -D @types/web-push
```

---

## Séquence d'implémentation

```
Types/Schéma → SW + Manifest → Layout mobile → Push backend → Push frontend
→ Triggers NATS → Pages mobile → Offline UX → Install prompt → Analytics → Tests
```

---

## Critères de validation (Definition of Done)

- [ ] Lighthouse PWA score ≥ 90 sur mobile Chrome
- [ ] Installable sur Android Chrome et iOS Safari 16.4+
- [ ] Notifications push reçues < 3 s après l'event NATS
- [ ] Mode offline : dashboard et exécutions lisibles sans réseau
- [ ] Aucune chaîne UI hardcodée (grep `JSX` pour string literals)
- [ ] Zéro régression desktop (tests Playwright viewport 1280px)
- [ ] Coverage business logic push ≥ 80%

---

## Out of Scope (v1)

- Éditeur de workflow sur mobile
- App native (React Native / Expo) — envisagé en v2 si rétention PWA < 40%
- Biométrie / FaceID (v2)
- Mode multi-compte sur mobile (v2)
