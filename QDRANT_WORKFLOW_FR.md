# Rôle de Qdrant et workflow complet dans ce projet

## 1) Rôle de Qdrant

Dans ce projet, **Qdrant est le moteur de recherche vectorielle**. Il est utilisé par `vector-service` pour :

- créer des collections vectorielles ;
- indexer (upsert) des documents sous forme de points (id, vecteur, payload) ;
- exécuter des recherches de similarité (`search`) avec score.

Le service applicatif conserve les métadonnées de collection en base relationnelle (Prisma/PostgreSQL), tandis que les vecteurs et la recherche de proximité sont délégués à Qdrant.

## 2) Workflow bout-en-bout

### A. Provisioning et connexion

1. `docker-compose` démarre le conteneur Qdrant (`qdrant/qdrant`) exposé sur `6333` et persiste les données dans un volume.
2. Au démarrage de `vector-service`, `QdrantClientService` lit `QDRANT_URL` (par défaut `http://qdrant:6333`) et teste la connexion via `getCollections()`.

### B. Création d’une collection

1. `POST /vectors/collections` arrive dans `VectorController`.
2. `CreateCollectionUseCase` vérifie l’unicité (`name + userId`) côté repository.
3. La collection logique construit son nom physique Qdrant via `userId_name` (`getQdrantCollectionName`).
4. Le use-case mappe la distance métier (`cosine`, `euclidean`, `dot`) vers Qdrant (`Cosine`, `Euclid`, `Dot`).
5. Le client Qdrant appelle `createCollection(...)`.
6. Les métadonnées de collection sont ensuite enregistrées via Prisma.

### C. Indexation (upsert) de documents

1. `POST /vectors/documents` ou `/vectors/documents/batch`.
2. Le use-case récupère la collection et valide son existence.
3. Si l’embedding n’est pas fourni, `EmbeddingService` en génère un (implémentation placeholder actuelle).
4. Le use-case vérifie la dimension (`embedding.length === collection.dimension`).
5. Chaque document est converti en point Qdrant (`id`, `vector`, `payload` avec `content`, `metadata`, `createdAt`).
6. `QdrantClientService.upsertPoints(...)` fait un `upsert` avec `wait: true`.

### D. Recherche de similarité

1. `POST /vectors/search`.
2. Le use-case récupère la collection et valide la dimension du vecteur requête.
3. Si besoin, embedding calculé depuis `query`.
4. Appel `qdrantClient.search(...)` avec `limit` et filtre optionnel.
5. Le filtre applicatif est transformé en filtre Qdrant via `buildQdrantFilter` (`metadata.<key> = value`).
6. Retour des résultats mappés (`id`, `score`, `content`, `metadata`).

### E. Suppression

- Le client Qdrant expose bien `deleteCollection`, mais le endpoint `DELETE /vectors/collections/:id` supprime aujourd’hui uniquement la collection dans la base applicative via repository.
- Il n’y a pas d’appel explicite à `qdrantClient.deleteCollection(...)` dans ce flux.

## 3) Proposition d’optimisation prioritaire

### Problème

Le flux de suppression peut laisser des **collections orphelines dans Qdrant** (fuite de stockage + coût de recherche) car la suppression API ne semble pas synchroniser la suppression côté Qdrant.

### Optimisation recommandée (haute valeur / faible risque)

Implémenter un `DeleteCollectionUseCase` transactionnel applicatif :

1. lire la collection en DB pour récupérer `userId` et `name` ;
2. calculer le nom Qdrant (`userId_name`) ;
3. supprimer d’abord dans Qdrant (idempotent: ignorer NotFound) ;
4. supprimer ensuite la ligne DB ;
5. journaliser les deux opérations et exposer un statut de cohérence.

### Gains attendus

- pas d’orphelins vectoriels ;
- cohérence fonctionnelle entre index vectoriel et métadonnées ;
- meilleure maîtrise des coûts et des performances de recherche.

## 4) Optimisations complémentaires

- **Embeddings réels**: remplacer le placeholder par un provider (OpenAI, bge, e5, etc.) ;
- **Index tuning Qdrant**: config HNSW/quantization par collection selon volume ;
- **Batching intelligent**: chunk d’upsert et parallélisme contrôlé pour gros imports ;
- **Observabilité**: métriques p95/p99 sur latence `upsert/search`, taille de collections, taux d’erreur ;
- **Lifecycle policy**: archivage/suppression auto de collections inactives.
