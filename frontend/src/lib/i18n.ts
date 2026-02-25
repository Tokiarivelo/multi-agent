import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Sidebar / Dashboard
      Dashboard: 'Dashboard',
      Workflows: 'Workflows',
      Agents: 'Agents',
      Tools: 'Tools',
      Models: 'Models',
      Executions: 'Executions',
      'Welcome back!': 'Welcome back!',
      Logout: 'Logout',
      'Multi-Agent': 'Multi-Agent',

      // Landing - Navbar
      Features: 'Features',
      Documentation: 'Documentation',
      'Get Started': 'Get Started',

      // Landing - Hero
      'v1.0 Now Available': 'v1.0 Now Available',
      'Orchestrate AI Agents': 'Orchestrate AI Agents',
      'Like Never Before.': 'Like Never Before.',
      'A powerful microservice architecture for building, deploying, and managing autonomous AI agents. Scale your workflows with heavy-duty tools, vector memory, and real-time event monitoring.':
        'A powerful microservice architecture for building, deploying, and managing autonomous AI agents. Scale your workflows with heavy-duty tools, vector memory, and real-time event monitoring.',
      'Launch Dashboard': 'Launch Dashboard',
      'Read Docs': 'Read Docs',

      // Landing - Features
      'Core Services': 'Core Services',
      'Agent Service': 'Agent Service',
      'Manage autonomous agents with customizable system prompts, model configurations, and tool access.':
        'Manage autonomous agents with customizable system prompts, model configurations, and tool access.',
      Orchestration: 'Orchestration',
      'Chain agents together in complex workflows. Define conditional logic and parallel execution paths.':
        'Chain agents together in complex workflows. Define conditional logic and parallel execution paths.',
      'Tool Service': 'Tool Service',
      'Securely execute tools in sandboxed environments. Create custom tools with typed schemas.':
        'Securely execute tools in sandboxed environments. Create custom tools with typed schemas.',
      'Vector Memory': 'Vector Memory',
      'Long-term semantic memory for agents using Qdrant. Automatically ingest and retrieve context.':
        'Long-term semantic memory for agents using Qdrant. Automatically ingest and retrieve context.',
      'Event Gateway': 'Event Gateway',
      'Real-time WebSocket monitoring of all system events. Watch your agents think and act live.':
        'Real-time WebSocket monitoring of all system events. Watch your agents think and act live.',
      'Model Abstraction': 'Model Abstraction',
      'Switch between LLM providers (OpenAI, Anthropic, Gemini) instantly with a unified API.':
        'Switch between LLM providers (OpenAI, Anthropic, Gemini) instantly with a unified API.',

      // Landing - Use Cases
      'Built for scale & complexity': 'Built for scale & complexity',
      'RAG Systems': 'RAG Systems',
      'Build Retrieval-Augmented Generation pipelines that ingest docs and answer queries with citations.':
        'Build Retrieval-Augmented Generation pipelines that ingest docs and answer queries with citations.',
      'Autonomous Research': 'Autonomous Research',
      'Deploy agents that browse the web, scrape data, summarize findings, and generate reports automatically.':
        'Deploy agents that browse the web, scrape data, summarize findings, and generate reports automatically.',
      'DevOps Automation': 'DevOps Automation',
      'Create agents that monitor logs, diagnose issues, and even trigger remediation scripts safely.':
        'Create agents that monitor logs, diagnose issues, and even trigger remediation scripts safely.',
      'Execution Log': 'Execution Log',

      // Landing - Footer
      'Multi-Agent Architecture. Built with NestJS, Next.js, and NATS.':
        'Multi-Agent Architecture. Built with NestJS, Next.js, and NATS.',

      // Auth Menu
      Language: 'Language',
      Theme: 'Theme',
      'Log out': 'Log out',

      // Docs Page
      'docs.subtitle': 'Technical overview of the Multi-Agent Architecture system.',
      'docs.architecture.title': 'Architecture Overview',
      'docs.architecture.description':
        'This project uses a microservices architecture built with NestJS for the backend and Next.js for the frontend. Services communicate asynchronously via NATS JetStream, ensuring scalability and fault tolerance.',
      'docs.services.agent':
        'Manages agent definitions (prompts, models) and handles individual agent execution requests.',
      'docs.services.orchestration.title': 'Orchestration Service',
      'docs.services.orchestration':
        'Coordinates multi-step workflows. It breaks down complex tasks into sub-tasks and delegates them to agents.',
      'docs.services.tool':
        'A secure registry and execution environment for tools (Python/JS scripts, API calls) that agents can use.',
      'docs.services.vector.title': 'Vector Service',
      'docs.services.vector':
        'Provides semantic search capabilities using Qdrant. Used for RAG and long-term agent memory.',
      'docs.services.model.title': 'Model Service',
      'docs.services.model':
        'Abstracts LLM providers. Handles API keys, rate limits, and model configuration centrally.',
      'docs.auth.title': 'Authentication',
      'docs.auth.description':
        'Authentication is handled by the Gateway Service using JWTs. The frontend uses NextAuth.js to manage sessions securely. All API requests to backend services must pass through the Gateway, which validates the JWT key.',
      'docs.events.title': 'Event System',
      'docs.events.description':
        "The system is event-driven. Agents emit events (e.g., agent.thought, tool.result) which are published to NATS. The Flux Watcher (/monitor) listens to these events via WebSockets to provide real-time visibility into the system's reasoning process.",
      'docs.backToHome': '← Back to Home',

      // Models - Create Modal
      'models.create.title': 'Add New Model',
      'models.create.subtitle': 'Configure a language model for the agents.',
      'models.create.provider': 'Provider',
      'models.create.modelEngineId': 'Model Engine ID',
      'models.create.displayName': 'Model Display Name',
      'models.create.maxTokens': 'Max Tokens',
      'models.create.cancel': 'Cancel',
      'models.create.save': 'Save Model',
      'models.create.saving': 'Saving...',
      'models.create.selectModel': '— Select a model —',
      'models.create.enterManually': 'Enter manually',
      'models.create.selectFromList': 'Select from list',
      'models.create.fetchingModels': 'Fetching available models...',
      'models.create.fetchError':
        'Could not fetch models. Please add a valid API key for this provider, or enter a model ID manually.',
      'models.create.customHint': 'Use CUSTOM for self-hosted or OpenAI-compatible endpoints.',
      'models.create.customModelPlaceholder': 'e.g. my-fine-tuned-model',
      'models.create.apiBaseUrl': 'API Base URL (optional)',
      'models.create.apiBaseUrlHint':
        'The base URL for the model API. Leave empty for standard providers.',

      // Sidebar
      'API Keys': 'API Keys',

      // API Keys Page
      'apiKeys.title': 'API Keys',
      'apiKeys.subtitle': 'Manage authentication keys for your model providers.',
      'apiKeys.addKey': 'Add API Key',
      'apiKeys.key': 'key',
      'apiKeys.keys': 'keys',
      'apiKeys.error': 'Failed to load API keys.',
      'apiKeys.stats.total': 'Total Keys',
      'apiKeys.stats.active': 'Active & Valid',
      'apiKeys.stats.providers': 'Providers',
      'apiKeys.empty.title': 'No API keys configured',
      'apiKeys.empty.description':
        'Add your first API key to start using LLM providers. Keys are encrypted and securely stored.',
      'apiKeys.empty.addFirst': 'Add your first key',

      // API Keys Card
      'apiKeys.card.unnamed': 'Unnamed Key',
      'apiKeys.card.valid': 'Valid',
      'apiKeys.card.invalid': 'Invalid',
      'apiKeys.card.active': 'Active',
      'apiKeys.card.inactive': 'Inactive',
      'apiKeys.card.created': 'Created',
      'apiKeys.card.lastUsed': 'Last used',
      'apiKeys.card.activate': 'Activate',
      'apiKeys.card.deactivate': 'Deactivate',
      'apiKeys.card.delete': 'Delete',
      'apiKeys.card.confirmDelete':
        'Are you sure you want to delete this API key? This action cannot be undone.',

      // API Keys Create Modal
      'apiKeys.create.title': 'Add API Key',
      'apiKeys.create.subtitle': 'Securely store an API key for a model provider.',
      'apiKeys.create.securityNote':
        'Your API key will be encrypted and stored securely. It will never be visible again after creation.',
      'apiKeys.create.provider': 'Provider',
      'apiKeys.create.keyName': 'Key Name',
      'apiKeys.create.keyNamePlaceholder': 'e.g. My Personal OpenAI Key',
      'apiKeys.create.apiKeyValue': 'API Key Value',
      'apiKeys.create.cancel': 'Cancel',
      'apiKeys.create.save': 'Save API Key',
      'apiKeys.create.saving': 'Saving...',
    },
  },
  fr: {
    translation: {
      // Sidebar / Dashboard
      Dashboard: 'Tableau de bord',
      Workflows: 'Flux de travail',
      Agents: 'Agents',
      Tools: 'Outils',
      Models: 'Modèles',
      Executions: 'Exécutions',
      'Welcome back!': 'Bienvenue !',
      Logout: 'Déconnexion',
      'Multi-Agent': 'Multi-Agent',

      // Landing - Navbar
      Features: 'Fonctionnalités',
      Documentation: 'Documentation',
      'Get Started': 'Commencer',

      // Landing - Hero
      'v1.0 Now Available': 'v1.0 Disponible maintenant',
      'Orchestrate AI Agents': 'Orchestrez des agents IA',
      'Like Never Before.': 'Comme jamais auparavant.',
      'A powerful microservice architecture for building, deploying, and managing autonomous AI agents. Scale your workflows with heavy-duty tools, vector memory, and real-time event monitoring.':
        "Une architecture microservices puissante pour créer, déployer et gérer des agents IA autonomes. Faites évoluer vos flux de travail avec des outils avancés, une mémoire vectorielle et un suivi d'événements en temps réel.",
      'Launch Dashboard': 'Lancer le tableau de bord',
      'Read Docs': 'Lire la doc',

      // Landing - Features
      'Core Services': 'Services principaux',
      'Agent Service': "Service d'agents",
      'Manage autonomous agents with customizable system prompts, model configurations, and tool access.':
        'Gérez des agents autonomes avec des prompts personnalisables, des configurations de modèles et un accès aux outils.',
      Orchestration: 'Orchestration',
      'Chain agents together in complex workflows. Define conditional logic and parallel execution paths.':
        "Enchaînez des agents dans des flux de travail complexes. Définissez des logiques conditionnelles et des chemins d'exécution parallèles.",
      'Tool Service': "Service d'outils",
      'Securely execute tools in sandboxed environments. Create custom tools with typed schemas.':
        'Exécutez des outils en toute sécurité dans des environnements isolés. Créez des outils personnalisés avec des schémas typés.',
      'Vector Memory': 'Mémoire vectorielle',
      'Long-term semantic memory for agents using Qdrant. Automatically ingest and retrieve context.':
        'Mémoire sémantique à long terme pour les agents via Qdrant. Ingestion et récupération automatique du contexte.',
      'Event Gateway': "Passerelle d'événements",
      'Real-time WebSocket monitoring of all system events. Watch your agents think and act live.':
        'Surveillance WebSocket en temps réel de tous les événements système. Regardez vos agents penser et agir en direct.',
      'Model Abstraction': 'Abstraction de modèles',
      'Switch between LLM providers (OpenAI, Anthropic, Gemini) instantly with a unified API.':
        'Basculez entre les fournisseurs LLM (OpenAI, Anthropic, Gemini) instantanément avec une API unifiée.',

      // Landing - Use Cases
      'Built for scale & complexity': "Conçu pour l'échelle et la complexité",
      'RAG Systems': 'Systèmes RAG',
      'Build Retrieval-Augmented Generation pipelines that ingest docs and answer queries with citations.':
        'Construisez des pipelines de génération augmentée par récupération qui ingèrent des documents et répondent aux requêtes avec des citations.',
      'Autonomous Research': 'Recherche autonome',
      'Deploy agents that browse the web, scrape data, summarize findings, and generate reports automatically.':
        'Déployez des agents qui naviguent sur le web, collectent des données, résument les résultats et génèrent des rapports automatiquement.',
      'DevOps Automation': 'Automatisation DevOps',
      'Create agents that monitor logs, diagnose issues, and even trigger remediation scripts safely.':
        'Créez des agents qui surveillent les journaux, diagnostiquent les problèmes et déclenchent des scripts de remédiation en toute sécurité.',
      'Execution Log': "Journal d'exécution",

      // Landing - Footer
      'Multi-Agent Architecture. Built with NestJS, Next.js, and NATS.':
        'Architecture Multi-Agent. Construit avec NestJS, Next.js, et NATS.',

      // Auth Menu
      Language: 'Langue',
      Theme: 'Thème',
      'Log out': 'Se déconnecter',

      // Docs Page
      'docs.subtitle': "Vue d'ensemble technique du système d'architecture Multi-Agent.",
      'docs.architecture.title': "Vue d'ensemble de l'architecture",
      'docs.architecture.description':
        'Ce projet utilise une architecture microservices construite avec NestJS pour le backend et Next.js pour le frontend. Les services communiquent de manière asynchrone via NATS JetStream, garantissant évolutivité et tolérance aux pannes.',
      'docs.services.agent':
        "Gère les définitions d'agents (prompts, modèles) et traite les demandes d'exécution individuelles des agents.",
      'docs.services.orchestration.title': "Service d'orchestration",
      'docs.services.orchestration':
        'Coordonne les flux de travail multi-étapes. Il décompose les tâches complexes en sous-tâches et les délègue aux agents.',
      'docs.services.tool':
        "Un registre sécurisé et un environnement d'exécution pour les outils (scripts Python/JS, appels API) que les agents peuvent utiliser.",
      'docs.services.vector.title': 'Service vectoriel',
      'docs.services.vector':
        'Fournit des capacités de recherche sémantique via Qdrant. Utilisé pour le RAG et la mémoire à long terme des agents.',
      'docs.services.model.title': 'Service de modèles',
      'docs.services.model':
        'Abstrait les fournisseurs LLM. Gère les clés API, les limites de débit et la configuration des modèles de manière centralisée.',
      'docs.auth.title': 'Authentification',
      'docs.auth.description':
        "L'authentification est gérée par le Service Gateway à l'aide de JWTs. Le frontend utilise NextAuth.js pour gérer les sessions de manière sécurisée. Toutes les requêtes API vers les services backend doivent passer par le Gateway, qui valide la clé JWT.",
      'docs.events.title': "Système d'événements",
      'docs.events.description':
        'Le système est piloté par les événements. Les agents émettent des événements (ex: agent.thought, tool.result) qui sont publiés sur NATS. Le Flux Watcher (/monitor) écoute ces événements via WebSockets pour offrir une visibilité en temps réel sur le processus de raisonnement du système.',
      'docs.backToHome': "← Retour à l'accueil",

      // Models - Create Modal
      'models.create.title': 'Ajouter un nouveau modèle',
      'models.create.subtitle': 'Configurer un modèle de langage pour les agents.',
      'models.create.provider': 'Fournisseur',
      'models.create.modelEngineId': 'ID du moteur',
      'models.create.displayName': "Nom d'affichage",
      'models.create.maxTokens': 'Tokens maximum',
      'models.create.cancel': 'Annuler',
      'models.create.save': 'Enregistrer le modèle',
      'models.create.saving': 'Enregistrement...',
      'models.create.selectModel': '— Sélectionner un modèle —',
      'models.create.enterManually': 'Saisir manuellement',
      'models.create.selectFromList': 'Sélectionner dans la liste',
      'models.create.fetchingModels': 'Récupération des modèles disponibles...',
      'models.create.fetchError':
        'Impossible de récupérer les modèles. Veuillez ajouter une clé API valide pour ce fournisseur, ou saisissez un ID de modèle manuellement.',
      'models.create.customHint':
        'Utilisez CUSTOM pour les endpoints auto-hébergés ou compatibles OpenAI.',
      'models.create.customModelPlaceholder': 'ex. mon-modele-personnalise',
      'models.create.apiBaseUrl': "URL de base de l'API (optionnel)",
      'models.create.apiBaseUrlHint':
        "L'URL de base de l'API du modèle. Laissez vide pour les fournisseurs standards.",

      // Sidebar
      'API Keys': 'Clés API',

      // API Keys Page
      'apiKeys.title': 'Clés API',
      'apiKeys.subtitle': "Gérez les clés d'authentification pour vos fournisseurs de modèles.",
      'apiKeys.addKey': 'Ajouter une clé API',
      'apiKeys.key': 'clé',
      'apiKeys.keys': 'clés',
      'apiKeys.error': 'Impossible de charger les clés API.',
      'apiKeys.stats.total': 'Total des clés',
      'apiKeys.stats.active': 'Actives & valides',
      'apiKeys.stats.providers': 'Fournisseurs',
      'apiKeys.empty.title': 'Aucune clé API configurée',
      'apiKeys.empty.description':
        'Ajoutez votre première clé API pour commencer à utiliser les fournisseurs LLM. Les clés sont chiffrées et stockées en toute sécurité.',
      'apiKeys.empty.addFirst': 'Ajouter votre première clé',

      // API Keys Card
      'apiKeys.card.unnamed': 'Clé sans nom',
      'apiKeys.card.valid': 'Valide',
      'apiKeys.card.invalid': 'Invalide',
      'apiKeys.card.active': 'Active',
      'apiKeys.card.inactive': 'Inactive',
      'apiKeys.card.created': 'Créée le',
      'apiKeys.card.lastUsed': 'Dernière utilisation',
      'apiKeys.card.activate': 'Activer',
      'apiKeys.card.deactivate': 'Désactiver',
      'apiKeys.card.delete': 'Supprimer',
      'apiKeys.card.confirmDelete':
        'Êtes-vous sûr de vouloir supprimer cette clé API ? Cette action est irréversible.',

      // API Keys Create Modal
      'apiKeys.create.title': 'Ajouter une clé API',
      'apiKeys.create.subtitle':
        'Stocker une clé API de manière sécurisée pour un fournisseur de modèles.',
      'apiKeys.create.securityNote':
        'Votre clé API sera chiffrée et stockée en toute sécurité. Elle ne sera plus jamais visible après la création.',
      'apiKeys.create.provider': 'Fournisseur',
      'apiKeys.create.keyName': 'Nom de la clé',
      'apiKeys.create.keyNamePlaceholder': 'ex. Ma clé OpenAI personnelle',
      'apiKeys.create.apiKeyValue': 'Valeur de la clé API',
      'apiKeys.create.cancel': 'Annuler',
      'apiKeys.create.save': 'Enregistrer la clé API',
      'apiKeys.create.saving': 'Enregistrement...',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en', // default language
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
