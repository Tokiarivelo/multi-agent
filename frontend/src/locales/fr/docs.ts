export const docs = {
  "docs.subtitle": "Vue d'ensemble technique du système d'architecture Multi-Agent.",
  "docs.architecture.title": "Vue d'ensemble de l'architecture",
  "docs.architecture.description": "Ce projet utilise une architecture microservices construite avec NestJS pour le backend et Next.js pour le frontend. Les services communiquent de manière asynchrone via NATS JetStream, garantissant évolutivité et tolérance aux pannes.",
  "docs.services.agent": "Gère les définitions d'agents (prompts, modèles) et traite les demandes d'exécution individuelles des agents.",
  "docs.services.orchestration.title": "Service d'orchestration",
  "docs.services.orchestration": "Coordonne les flux de travail multi-étapes. Il décompose les tâches complexes en sous-tâches et les délègue aux agents.",
  "docs.services.tool": "Un registre sécurisé et un environnement d'exécution pour les outils (scripts Python/JS, appels API) que les agents peuvent utiliser.",
  "docs.services.vector.title": "Service vectoriel",
  "docs.services.vector": "Fournit des capacités de recherche sémantique via Qdrant. Utilisé pour le RAG et la mémoire à long terme des agents.",
  "docs.services.model.title": "Service de modèles",
  "docs.services.model": "Abstrait les fournisseurs LLM. Gère les clés API, les limites de débit et la configuration des modèles de manière centralisée.",
  "docs.auth.title": "Authentification",
  "docs.auth.description": "L'authentification est gérée par le Service Gateway à l'aide de JWTs. Le frontend utilise NextAuth.js pour gérer les sessions de manière sécurisée. Toutes les requêtes API vers les services backend doivent passer par le Gateway, qui valide la clé JWT.",
  "docs.events.title": "Système d'événements",
  "docs.events.description": "Le système est piloté par les événements. Les agents émettent des événements (ex: agent.thought, tool.result) qui sont publiés sur NATS. Le Flux Watcher (/monitor) écoute ces événements via WebSockets pour offrir une visibilité en temps réel sur le processus de raisonnement du système.",
  "docs.backToHome": "← Retour à l'accueil"
};
