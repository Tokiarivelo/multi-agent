# Service Gateway (Go)

> Passerelle API haute performance et reverse proxy pour la plateforme Multi-Agent.

## Aperçu

Ce service remplace la passerelle API d'origine (Node.js/NestJS) par une implémentation Go, réduisant l'empreinte mémoire d'environ 90% et améliorant considérablement la latence du proxy.

Il gère :
- **Reverse Proxy** — routage transparent des requêtes `/api/*` vers les microservices internes
- **Authentification** — émission de JWT et gestion des endpoints `/api/auth/*`
- **Paramètres utilisateur** — `GET|PATCH /api/users/me/settings`
- **Relais WebSocket** — pont entre les clients WebSocket et le bus NATS
- **Sécurité** — CORS, validation des jetons Bearer

## Port

`3000` — point d'entrée unique pour tout le trafic frontend → backend.

## Stack

| Bibliothèque | Rôle |
|--------------|------|
| Gin | Routeur HTTP |
| golang-jwt/jwt | Émission et validation des JWT |
| pgx/v5 | PostgreSQL |
| nats.go | Messagerie NATS |
| swaggo/gin-swagger | Interface Swagger |

## Interface Swagger

L'explorateur interactif est disponible à **`http://localhost:3000/docs/index.html`** lorsque le service est en cours d'exécution.

JSON OpenAPI : `http://localhost:3000/docs/doc.json`

Pour régénérer la documentation après modification des annotations :

```bash
cd services/gateway-service-go
swag init --dir cmd/server,internal --output internal/docs --parseDependency --parseInternal
```

## API

### `GET /health`
Sonde de vivacité. Retourne `{ "status": "ok" }`. Aucune authentification requise.

### Auth

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `POST` | `/api/auth/register` | Créer un nouveau compte utilisateur |
| `POST` | `/api/auth/login` | S'authentifier avec email + mot de passe |
| `POST` | `/api/auth/social-login` | Connexion via un fournisseur OAuth |
| `GET` | `/api/auth/me` | Retourner le profil de l'utilisateur courant |

Tous les endpoints d'auth retournent `{ "accessToken": "...", "user": { ... } }`.

### Utilisateurs

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/api/users/me/settings` | Retourner les paramètres de l'espace de travail |
| `PATCH` | `/api/users/me/settings` | Fusionner un patch de paramètres |

### WebSocket

`GET /ws` — relais NATS. Nécessite un jeton Bearer valide (via `?token=` ou l'en-tête `Authorization`).

### Proxy

Toutes les autres requêtes `GET|POST|PUT|PATCH|DELETE /api/<service>/*` sont transmises par proxy inverse au microservice correspondant. Le gateway injecte `userId` issu du JWT dans la requête amont.

## Exécution locale

```bash
cd services/gateway-service-go
go run cmd/server/main.go
```

Ou via le script de développement du monorepo :

```bash
pnpm dev
```

## Tests

```bash
go test ./...
```

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `GATEWAY_PORT` | `3000` | Port d'écoute |
| `DATABASE_URL` | requis | Chaîne de connexion PostgreSQL |
| `JWT_SECRET` | requis | Secret pour la signature des JWT |
| `NATS_URL` | `nats://localhost:4222` | URL du serveur NATS |
| `NODE_ENV` | `development` | Mettre à `production` pour le mode release Gin |

## Documentation

- [Architecture & Plan de Migration](../../docs/migration-high-performance.md)
