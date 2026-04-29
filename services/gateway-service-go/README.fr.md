# Service Gateway (Go)

> Passerelle API haute performance et reverse proxy pour la plateforme Multi-Agent.

## Aperçu
Ce service remplace la passerelle API d'origine (Node.js/NestJS) par une implémentation Go hautement optimisée, réduisant l'empreinte mémoire d'environ 90% et améliorant considérablement la latence du proxy.

Il gère :
- **Reverse Proxy** : Routage transparent des requêtes vers les microservices internes.
- **Authentification** : Émission de JWT et gestion des endpoints HTTP pour `/api/auth/*`.
- **Relais WebSocket** : Pont entre les clients WebSocket et le bus d'événements NATS.
- **Sécurité** : CORS, validation des jetons Bearer.

## Développement

### Prérequis
- Go 1.22+

### Exécution locale
Le service est automatiquement démarré via le `Makefile` racine lors de l'exécution de `make dev-all` ou `pnpm dev`.
```bash
# Exécution indépendante
GATEWAY_PORT=3000 go run cmd/server/main.go
```

### Tests
```bash
go test ./...
```

## Documentation
- [Architecture & Plan de Migration](../../docs/migration-high-performance.md)
