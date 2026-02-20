import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <h1 className="text-4xl font-bold text-white mb-2">Documentation</h1>
        <p className="text-gray-400 mb-12 border-b border-gray-800 pb-8">
          Technical overview of the Multi-Agent Architecture system.
        </p>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-blue-400">Architecture Overview</h2>
          <p className="mb-4 leading-relaxed">
            This project uses a microservices architecture built with NestJS for the backend and
            Next.js for the frontend. Services communicate asynchronously via NATS JetStream,
            ensuring scalability and fault tolerance.
          </p>
          <div className="bg-black/50 p-6 rounded-lg border border-gray-800 font-mono text-xs">
            {`
[Frontend] <--> [Gateway Service] <--> [NATS Bus]
                       |
            +----------+----------+
            |          |          |
      [Agent Svc] [Orch Svc] [Tool Svc] ...
            `}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-blue-400">Core Services</h2>

          <div className="space-y-8">
            <DocService
              title="Agent Service"
              desc="Manages agent definitions (prompts, models) and handles individual agent execution requests."
            />
            <DocService
              title="Orchestration Service"
              desc="Coordinates multi-step workflows. It breaks down complex tasks into sub-tasks and delegates them to agents."
            />
            <DocService
              title="Tool Service"
              desc="A secure registry and execution environment for tools (Python/JS scripts, API calls) that agents can use."
            />
            <DocService
              title="Vector Service"
              desc="Provides semantic search capabilities using Qdrant. Used for RAG and long-term agent memory."
            />
            <DocService
              title="Model Service"
              desc="Abstracts LLM providers. Handles API keys, rate limits, and model configuration centrally."
            />
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-blue-400">Authentication</h2>
          <p className="mb-4 leading-relaxed">
            Authentication is handled by the Gateway Service using JWTs. The frontend uses
            NextAuth.js to manage sessions securely. All API requests to backend services must pass
            through the Gateway, which validates the JWT key.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-blue-400">Event System</h2>
          <p className="mb-4 leading-relaxed">
            The system is event-driven. Agents emit events (e.g., `agent.thought`, `tool.result`)
            which are published to NATS. The Flux Watcher (`/monitor`) listens to these events via
            WebSockets to provide real-time visibility into the system&apos;s reasoning process.
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <Link href="/" className="text-blue-500 hover:text-blue-400">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function DocService({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-800">
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 leading-relaxed text-sm">{desc}</p>
    </div>
  );
}
