import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

type NodeType =
  | 'START'
  | 'END'
  | 'AGENT'
  | 'EMAIL'
  | 'SLACK'
  | 'TOOL'
  | 'TRANSFORM'
  | 'PROMPT'
  | 'DOCUMENT';

interface StepSpec {
  id: string;
  type: NodeType;
  name: string;
  config?: Record<string, unknown>;
}

function buildDefinition(steps: StepSpec[]) {
  const startNode = { id: 'start', type: 'START', config: {}, position: { x: 100, y: 100 } };
  const endNode = {
    id: 'end',
    type: 'END',
    config: {},
    position: { x: 100, y: (steps.length + 2) * 140 },
  };
  const actionNodes = steps.map((s, i) => ({
    id: s.id,
    type: s.type,
    customName: s.name,
    config: s.config ?? {},
    position: { x: 100, y: (i + 1) * 140 + 100 },
  }));

  const allNodes = [startNode, ...actionNodes, endNode];
  const edges = allNodes.slice(0, -1).map((n, i) => ({
    id: `e${i + 1}`,
    source: n.id,
    target: allNodes[i + 1]!.id,
  }));

  return { nodes: allNodes, edges, version: 1 };
}

const templates = [
  // ── Automation ──────────────────────────────────────────────────────────
  {
    name: 'Email Digest quotidien',
    description: "Récupère vos emails du jour, les résume avec l'IA et envoie un digest synthétique.",
    category: 'Automation',
    tags: ['email', 'digest', 'daily'],
    isFeatured: true,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'EMAIL' as NodeType, name: 'Fetch Today Emails', config: { operation: 'fetch', filter: 'today' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Summarize Emails', config: { prompt: 'Summarize these emails into a concise digest' } },
      { id: 's3', type: 'EMAIL' as NodeType, name: 'Send Digest', config: { operation: 'send' } },
    ],
  },
  {
    name: 'Résumé Slack hebdomadaire',
    description: 'Consolide les messages Slack de la semaine et produit un résumé par channel.',
    category: 'Automation',
    tags: ['slack', 'weekly', 'summary'],
    isFeatured: true,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'SLACK' as NodeType, name: 'Fetch Slack Messages', config: { period: 'week' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Group by Channel', config: { prompt: 'Group and summarize messages by channel' } },
      { id: 's3', type: 'SLACK' as NodeType, name: 'Post Summary', config: { operation: 'send' } },
    ],
  },

  // ── AI ───────────────────────────────────────────────────────────────────
  {
    name: 'Veille concurrentielle',
    description: 'Scrape les sites concurrents, extrait les données clés et génère un rapport IA.',
    category: 'AI',
    tags: ['competitive', 'research', 'scraping'],
    isFeatured: true,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Scrape Competitor Sites', config: { tool: 'web_scraper' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Extract Key Data', config: { prompt: 'Extract pricing, features and positioning' } },
      { id: 's3', type: 'DOCUMENT' as NodeType, name: 'Generate Report' },
    ],
  },
  {
    name: 'Rédaction de rapport mensuel',
    description: 'Collecte les données des outils connectés et rédige automatiquement le rapport mensuel.',
    category: 'AI',
    tags: ['report', 'monthly', 'writing'],
    isFeatured: true,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch Analytics Data', config: { tool: 'http_request' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Draft Report', config: { prompt: 'Write a professional monthly report from the data' } },
      { id: 's3', type: 'DOCUMENT' as NodeType, name: 'Save Report' },
    ],
  },
  {
    name: 'Classification de tickets support',
    description: 'Classe automatiquement les tickets entrants par priorité et catégorie.',
    category: 'AI',
    tags: ['support', 'classification', 'tickets'],
    isFeatured: true,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch New Tickets', config: { tool: 'http_request', endpoint: 'support_api' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Classify & Prioritize', config: { prompt: 'Classify each ticket by category and priority (P1/P2/P3)' } },
      { id: 's3', type: 'TOOL' as NodeType, name: 'Update Ticket System', config: { tool: 'http_request', method: 'PATCH' } },
    ],
  },
  {
    name: 'Pipeline de traitement de documents',
    description: 'Extrait, structure et indexe le contenu de documents PDF ou Word.',
    category: 'AI',
    tags: ['documents', 'extraction', 'indexing'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'DOCUMENT' as NodeType, name: 'Ingest Document' },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Extract & Structure', config: { prompt: 'Extract key sections, tables, and metadata' } },
      { id: 's3', type: 'TRANSFORM' as NodeType, name: 'Format Output', config: { format: 'json' } },
    ],
  },
  {
    name: 'Génération de synthèse de réunion',
    description: 'Prend les notes ou transcriptions de réunion et génère une synthèse structurée.',
    category: 'AI',
    tags: ['meeting', 'notes', 'summary'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'PROMPT' as NodeType, name: 'Input Transcript', config: { placeholder: 'Paste meeting transcript here' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Generate Summary', config: { prompt: 'Create structured meeting notes with decisions, action items, and next steps' } },
      { id: 's3', type: 'DOCUMENT' as NodeType, name: 'Save Summary' },
    ],
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  {
    name: 'Scraping & structuration de données',
    description: "Scrape des sources web et structure les données en JSON ou CSV prêt à l'analyse.",
    category: 'Data',
    tags: ['scraping', 'etl', 'json'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Web Scraper', config: { tool: 'web_scraper' } },
      { id: 's2', type: 'TRANSFORM' as NodeType, name: 'Parse & Structure', config: { format: 'json' } },
      { id: 's3', type: 'TOOL' as NodeType, name: 'Export Data', config: { tool: 'http_request', method: 'POST' } },
    ],
  },
  {
    name: 'Synchronisation CRM → base de données',
    description: 'Synchronise les contacts et opportunités du CRM vers votre base de données interne.',
    category: 'Data',
    tags: ['crm', 'sync', 'database'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch CRM Records', config: { tool: 'http_request', endpoint: 'crm_api' } },
      { id: 's2', type: 'TRANSFORM' as NodeType, name: 'Map Fields', config: { mapping: 'crm_to_db' } },
      { id: 's3', type: 'TOOL' as NodeType, name: 'Upsert to DB', config: { tool: 'http_request', method: 'PUT' } },
    ],
  },
  {
    name: 'Export analytics vers Google Sheets',
    description: "Récupère vos métriques d'analytics et les exporte dans un Google Sheet structuré.",
    category: 'Data',
    tags: ['analytics', 'google-sheets', 'export'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch Analytics', config: { tool: 'http_request', endpoint: 'analytics_api' } },
      { id: 's2', type: 'TRANSFORM' as NodeType, name: 'Format for Sheets', config: { format: 'sheets' } },
      { id: 's3', type: 'TOOL' as NodeType, name: 'Write to Google Sheets', config: { tool: 'http_request', endpoint: 'sheets_api' } },
    ],
  },

  // ── DevOps ───────────────────────────────────────────────────────────────
  {
    name: 'CI/CD notification Slack',
    description: 'Envoie une notification Slack formatée après chaque build CI/CD (succès ou échec).',
    category: 'DevOps',
    tags: ['ci', 'slack', 'notifications'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'PROMPT' as NodeType, name: 'Receive Build Event', config: { source: 'webhook' } },
      { id: 's2', type: 'TRANSFORM' as NodeType, name: 'Format Message', config: { template: 'ci_notification' } },
      { id: 's3', type: 'SLACK' as NodeType, name: 'Send to Channel', config: { operation: 'send' } },
    ],
  },
  {
    name: "Monitoring d'alertes GitHub",
    description: "Surveille les issues et PRs GitHub et notifie l'équipe selon des règles configurables.",
    category: 'DevOps',
    tags: ['github', 'monitoring', 'alerts'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Poll GitHub Events', config: { tool: 'http_request', endpoint: 'github_api' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Evaluate Alert Rules', config: { prompt: 'Check if any events match alert criteria' } },
      { id: 's3', type: 'SLACK' as NodeType, name: 'Send Alert', config: { operation: 'send', conditional: true } },
    ],
  },
  {
    name: 'Rapport de déploiement automatique',
    description: 'Génère un rapport de déploiement avec diff, tests passés et métriques de performance.',
    category: 'DevOps',
    tags: ['deployment', 'report', 'automation'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch Deploy Info', config: { tool: 'http_request', endpoint: 'deploy_api' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Generate Report', config: { prompt: 'Create a deployment report with key metrics and changes' } },
      { id: 's3', type: 'EMAIL' as NodeType, name: 'Email Team', config: { operation: 'send' } },
    ],
  },

  // ── HR ───────────────────────────────────────────────────────────────────
  {
    name: 'Onboarding nouvel employé',
    description: "Automatise l'envoi des accès, documents et messages de bienvenue pour un nouvel employé.",
    category: 'HR',
    tags: ['onboarding', 'hr', 'automation'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'PROMPT' as NodeType, name: 'Employee Details', config: { fields: ['name', 'email', 'role', 'start_date'] } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Prepare Welcome Package', config: { prompt: 'Create personalised onboarding checklist and welcome message' } },
      { id: 's3', type: 'EMAIL' as NodeType, name: 'Send Welcome Email', config: { operation: 'send' } },
    ],
  },
  {
    name: 'Suivi des candidatures recrutement',
    description: 'Centralise et met à jour le statut des candidatures depuis plusieurs job boards.',
    category: 'HR',
    tags: ['recruiting', 'candidates', 'tracking'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch Applications', config: { tool: 'http_request', endpoint: 'ats_api' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Score & Rank', config: { prompt: 'Score candidates against job requirements and rank them' } },
      { id: 's3', type: 'TOOL' as NodeType, name: 'Update ATS', config: { tool: 'http_request', method: 'PATCH' } },
    ],
  },

  // ── Productivity ─────────────────────────────────────────────────────────
  {
    name: 'Rappels de tâches Trello',
    description: "Envoie des rappels personnalisés pour les tâches Trello en retard ou en approche d'échéance.",
    category: 'Productivity',
    tags: ['trello', 'reminders', 'tasks'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch Trello Cards', config: { tool: 'http_request', endpoint: 'trello_api' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Filter Due Cards', config: { prompt: 'Find cards due within 24h or overdue' } },
      { id: 's3', type: 'SLACK' as NodeType, name: 'Send Reminders', config: { operation: 'send', perUser: true } },
    ],
  },
  {
    name: 'Gestion des deadlines projets',
    description: 'Agrège les deadlines de vos projets et génère une vue hebdomadaire priorisée.',
    category: 'Productivity',
    tags: ['deadlines', 'projects', 'planning'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Collect Project Deadlines', config: { tool: 'http_request' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Prioritize & Plan', config: { prompt: 'Create a prioritized weekly plan from project deadlines' } },
      { id: 's3', type: 'EMAIL' as NodeType, name: 'Send Weekly Plan', config: { operation: 'send' } },
    ],
  },

  // ── Marketing ────────────────────────────────────────────────────────────
  {
    name: 'Pipeline de génération de contenu',
    description: "Génère et programme des posts social media à partir d'un brief ou d'une URL source.",
    category: 'Marketing',
    tags: ['content', 'social-media', 'generation'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'PROMPT' as NodeType, name: 'Content Brief', config: { fields: ['topic', 'tone', 'platforms'] } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Generate Posts', config: { prompt: 'Create social media posts tailored to each platform' } },
      { id: 's3', type: 'TOOL' as NodeType, name: 'Schedule Posts', config: { tool: 'http_request', endpoint: 'scheduler_api' } },
    ],
  },
  {
    name: 'Suivi des mentions réseaux sociaux',
    description: 'Surveille les mentions de votre marque et alerte en temps réel sur les sujets sensibles.',
    category: 'Marketing',
    tags: ['social-media', 'monitoring', 'brand'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch Mentions', config: { tool: 'http_request', endpoint: 'social_api' } },
      { id: 's2', type: 'AGENT' as NodeType, name: 'Sentiment Analysis', config: { prompt: 'Analyze sentiment and flag negative or urgent mentions' } },
      { id: 's3', type: 'SLACK' as NodeType, name: 'Alert Team', config: { operation: 'send', onNegative: true } },
    ],
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  {
    name: 'Tableau de bord KPI automatique',
    description: 'Collecte vos KPIs depuis plusieurs sources et génère un dashboard HTML hebdomadaire.',
    category: 'Analytics',
    tags: ['kpi', 'dashboard', 'reporting'],
    isFeatured: false,
    authorName: 'Multi-Agent Team',
    steps: [
      { id: 's1', type: 'TOOL' as NodeType, name: 'Fetch KPIs', config: { tool: 'http_request', sources: ['analytics', 'crm', 'finance'] } },
      { id: 's2', type: 'TRANSFORM' as NodeType, name: 'Aggregate Metrics', config: { aggregation: 'weekly' } },
      { id: 's3', type: 'AGENT' as NodeType, name: 'Generate Dashboard', config: { prompt: 'Create a KPI dashboard with trends and insights in HTML' } },
    ],
  },
];

async function main() {
  await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    update: {},
    create: {
      id: SYSTEM_USER_ID,
      email: 'system@multi-agent.internal',
      firstName: 'System',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Seeding 20 marketplace templates…');

  for (const t of templates) {
    const definition = buildDefinition(t.steps);

    await prisma.workflow.upsert({
      where: {
        id: `template-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
      },
      update: {
        description: t.description,
        tags: t.tags,
        isFeatured: t.isFeatured,
        nodes: definition.nodes as never,
        edges: definition.edges as never,
        definition: definition as never,
      },
      create: {
        id: `template-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
        name: t.name,
        description: t.description,
        category: t.category,
        tags: t.tags,
        isTemplate: true,
        isFeatured: t.isFeatured,
        authorName: t.authorName,
        installsCount: 0,
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        userId: SYSTEM_USER_ID,
        nodes: definition.nodes as never,
        edges: definition.edges as never,
        definition: definition as never,
      },
    });

    console.log(`  ✓ ${t.name}`);
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
