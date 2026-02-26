'use client';

import { Bot, MessageSquare, Terminal, Wrench, Search, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ServiceCard } from './ServiceCard';

export function LandingFeatures() {
  const { t } = useTranslation();

  const services = [
    {
      icon: <Bot className="w-6 h-6 text-blue-500 dark:text-blue-400" />,
      titleKey: 'Agent Service',
      descriptionKey:
        'Manage autonomous agents with customizable system prompts, model configurations, and tool access.',
    },
    {
      icon: <Workflow className="w-6 h-6 text-purple-500 dark:text-purple-400" />,
      titleKey: 'Orchestration',
      descriptionKey:
        'Chain agents together in complex workflows. Define conditional logic and parallel execution paths.',
    },
    {
      icon: <Wrench className="w-6 h-6 text-green-500 dark:text-green-400" />,
      titleKey: 'Tool Service',
      descriptionKey:
        'Securely execute tools in sandboxed environments. Create custom tools with typed schemas.',
    },
    {
      icon: <Search className="w-6 h-6 text-orange-500 dark:text-orange-400" />,
      titleKey: 'Vector Memory',
      descriptionKey:
        'Long-term semantic memory for agents using Qdrant. Automatically ingest and retrieve context.',
    },
    {
      icon: <Terminal className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
      titleKey: 'Event Gateway',
      descriptionKey:
        'Real-time WebSocket monitoring of all system events. Watch your agents think and act live.',
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-pink-500 dark:text-pink-400" />,
      titleKey: 'Model Abstraction',
      descriptionKey:
        'Switch between LLM providers (OpenAI, Anthropic, Gemini) instantly with a unified API.',
    },
  ];

  return (
    <section
      id="features"
      className="py-24 border-t border-border/50 bg-muted/30 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold mb-16 text-center text-foreground">
          {t('Core Services')}
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <ServiceCard
              key={service.titleKey}
              icon={service.icon}
              title={t(service.titleKey)}
              description={t(service.descriptionKey)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
