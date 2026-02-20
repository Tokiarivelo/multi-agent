import Link from 'next/link';
import { Bot, MessageSquare, Terminal, Wrench, Search, Workflow, ChevronRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-black/50 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">M</span>
            </div>
            Multi-Agent
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <Link href="/docs" className="hover:text-white transition-colors">
              Documentation
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-lg shadow-purple-900/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-800 text-blue-400 text-xs font-semibold uppercase tracking-wide mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            v1.0 Now Available
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
            Orchestrate AI Agents <br /> Like Never Before.
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            A powerful microservice architecture for building, deploying, and managing autonomous AI
            agents. Scale your workflows with heavy-duty tools, vector memory, and real-time event
            monitoring.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all hover:scale-105 flex items-center gap-2"
            >
              Launch Dashboard <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/docs"
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-semibold transition-all"
            >
              Read Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-16 text-center">Core Services</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ServiceCard
              icon={<Bot className="w-6 h-6 text-blue-400" />}
              title="Agent Service"
              description="Manage autonomous agents with customizable system prompts, model configurations, and tool access."
            />
            <ServiceCard
              icon={<Workflow className="w-6 h-6 text-purple-400" />}
              title="Orchestration"
              description="Chain agents together in complex workflows. Define conditional logic and parallel execution paths."
            />
            <ServiceCard
              icon={<Wrench className="w-6 h-6 text-green-400" />}
              title="Tool Service"
              description="Securely execute tools in sandboxed environments. Create custom tools with typed schemas."
            />
            <ServiceCard
              icon={<Search className="w-6 h-6 text-orange-400" />}
              title="Vector Memory"
              description="Long-term semantic memory for agents using Qdrant. Automatically ingest and retrieve context."
            />
            <ServiceCard
              icon={<Terminal className="w-6 h-6 text-gray-400" />}
              title="Event Gateway"
              description="Real-time WebSocket monitoring of all system events. Watch your agents think and act live."
            />
            <ServiceCard
              icon={<MessageSquare className="w-6 h-6 text-pink-400" />}
              title="Model Abstraction"
              description="Switch between LLM providers (OpenAI, Anthropic, Gemini) instantly with a unified API."
            />
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Built for scale & complexity</h2>
              <div className="space-y-8">
                <UseCase
                  title="RAG Systems"
                  description="Build Retrieval-Augmented Generation pipelines that ingest docs and answer queries with citations."
                />
                <UseCase
                  title="Autonomous Research"
                  description="Deploy agents that browse the web, scrape data, summarize findings, and generate reports automatically."
                />
                <UseCase
                  title="DevOps Automation"
                  description="Create agents that monitor logs, diagnose issues, and even trigger remediation scripts safely."
                />
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full" />
              <div className="relative bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-4">
                  <span className="text-sm font-mono text-gray-400">Execution Log</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                </div>
                <div className="space-y-3 font-mono text-xs md:text-sm">
                  <div className="text-green-400">{`> Agent "ResearchBot" started`}</div>
                  <div className="text-blue-400">{`> Searching for "Deep learning trends 2026"`}</div>
                  <div className="text-purple-400">{`> Found 14 sources. Analyzing...`}</div>
                  <div className="text-gray-400">{`> Summarizing key points...`}</div>
                  <div className="text-green-400">{`> Report generated successfully.`}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-black text-center">
        <p className="text-gray-500 text-sm">
          © 2026 Multi-Agent Architecture. Built with NestJS, Next.js, and NATS.
        </p>
      </footer>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-white/[0.03] border border-white/5 hover:border-blue-500/50 hover:bg-white/[0.05] transition-all group">
      <div className="mb-4 p-3 bg-white/5 w-fit rounded-lg group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 text-gray-100">{title}</h3>
      <p className="text-gray-400 leading-relaxed text-sm">{description}</p>
    </div>
  );
}

function UseCase({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
        {title}
      </h4>
      <p className="text-gray-400 text-sm leading-relaxed pl-3.5 border-l border-white/10">
        {description}
      </p>
    </div>
  );
}
