export const docs = {
  "docs.subtitle": "Technical overview of the Multi-Agent Architecture system.",
  "docs.architecture.title": "Architecture Overview",
  "docs.architecture.description": "This project uses a microservices architecture built with NestJS for the backend and Next.js for the frontend. Services communicate asynchronously via NATS JetStream, ensuring scalability and fault tolerance.",
  "docs.services.agent": "Manages agent definitions (prompts, models) and handles individual agent execution requests.",
  "docs.services.orchestration.title": "Orchestration Service",
  "docs.services.orchestration": "Coordinates multi-step workflows. It breaks down complex tasks into sub-tasks and delegates them to agents.",
  "docs.services.tool": "A secure registry and execution environment for tools (Python/JS scripts, API calls) that agents can use.",
  "docs.services.vector.title": "Vector Service",
  "docs.services.vector": "Provides semantic search capabilities using Qdrant. Used for RAG and long-term agent memory.",
  "docs.services.model.title": "Model Service",
  "docs.services.model": "Abstracts LLM providers. Handles API keys, rate limits, and model configuration centrally.",
  "docs.auth.title": "Authentication",
  "docs.auth.description": "Authentication is handled by the Gateway Service using JWTs. The frontend uses NextAuth.js to manage sessions securely. All API requests to backend services must pass through the Gateway, which validates the JWT key.",
  "docs.events.title": "Event System",
  "docs.events.description": "The system is event-driven. Agents emit events (e.g., agent.thought, tool.result) which are published to NATS. The Flux Watcher (/monitor) listens to these events via WebSockets to provide real-time visibility into the system's reasoning process.",
  "docs.backToHome": "← Back to Home"
};
