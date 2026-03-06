import {
  Play,
  Square,
  Bot,
  Wrench,
  GitFork,
  Shuffle,
  MessageSquare,
  Type,
  File,
  Repeat2,
  Github,
  MessageCircle,
  Phone,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

export type NodeTypeId =
  | 'START'
  | 'END'
  | 'AGENT'
  | 'TOOL'
  | 'CONDITIONAL'
  | 'TRANSFORM'
  | 'PROMPT'
  | 'TEXT'
  | 'FILE'
  | 'LOOP'
  | 'GITHUB'
  | 'SLACK'
  | 'WHATSAPP'
  | 'SHELL';

export interface NodeTypeMeta {
  id: NodeTypeId;
  label: string;
  labelFr: string;
  description: string;
  descriptionFr: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultConfig: Record<string, unknown>;
}

export const NODE_TYPE_REGISTRY: NodeTypeMeta[] = [
  {
    id: 'START',
    label: 'Start',
    labelFr: 'Départ',
    description: 'Entry point of the workflow',
    descriptionFr: "Point d'entrée du workflow",
    icon: Play,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/40',
    defaultConfig: {},
  },
  {
    id: 'END',
    label: 'End',
    labelFr: 'Fin',
    description: 'Terminal node that ends the workflow',
    descriptionFr: 'Nœud terminal qui termine le workflow',
    icon: Square,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/40',
    defaultConfig: {},
  },
  {
    id: 'AGENT',
    label: 'Agent',
    labelFr: 'Agent',
    description: 'Run an AI agent',
    descriptionFr: 'Exécuter un agent IA',
    icon: Bot,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/40',
    defaultConfig: { agentId: '' },
  },
  {
    id: 'TOOL',
    label: 'Tool',
    labelFr: 'Outil',
    description: 'Execute a tool or function',
    descriptionFr: 'Exécuter un outil ou une fonction',
    icon: Wrench,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/40',
    defaultConfig: { toolId: '' },
  },
  {
    id: 'CONDITIONAL',
    label: 'Condition',
    labelFr: 'Condition',
    description: 'Branch based on a condition',
    descriptionFr: 'Branchement selon une condition',
    icon: GitFork,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/40',
    defaultConfig: { condition: '' },
  },
  {
    id: 'TRANSFORM',
    label: 'Transform',
    labelFr: 'Transformer',
    description: 'Transform or map data',
    descriptionFr: 'Transformer ou mapper des données',
    icon: Shuffle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/40',
    defaultConfig: { template: '' },
  },
  {
    id: 'PROMPT',
    label: 'Prompt',
    labelFr: 'Prompt',
    description: 'Provide a template prompt',
    descriptionFr: 'Fournir un prompt modèle',
    icon: MessageSquare,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/40',
    defaultConfig: { prompt: '' },
  },
  {
    id: 'TEXT',
    label: 'Text Node',
    labelFr: 'Nœud Texte',
    description: 'Insert raw text block',
    descriptionFr: 'Insérer un bloc de texte brut',
    icon: Type,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/40',
    defaultConfig: { text: '' },
  },
  {
    id: 'FILE',
    label: 'File',
    labelFr: 'Fichier',
    description: 'Load a file (image, pdf, txt, md)',
    descriptionFr: 'Charger un fichier (image, pdf, txt, md)',
    icon: File,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/40',
    defaultConfig: { files: [] },
  },
  {
    id: 'LOOP',
    label: 'Loop',
    labelFr: 'Boucle',
    description: 'Iterate over an array and transform each item',
    descriptionFr: 'Itérer sur un tableau et transformer chaque élément',
    icon: Repeat2,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/40',
    defaultConfig: {
      collection: '',
      itemScript: 'return item;',
      filterScript: '',
      maxIterations: 100,
    },
  },
  {
    id: 'GITHUB',
    label: 'GitHub API',
    labelFr: 'API GitHub',
    description: 'Execute requests against the GitHub REST API',
    descriptionFr: "Exécuter des requêtes vers l'API GitHub",
    icon: Github,
    color: 'text-neutral-500 dark:text-neutral-300',
    bgColor: 'bg-neutral-500/10 dark:bg-neutral-300/10',
    borderColor: 'border-neutral-500/40 dark:border-neutral-300/40',
    defaultConfig: { token: '', endpoint: '/user', method: 'GET', body: '' },
  },
  {
    id: 'SLACK',
    label: 'Slack Message',
    labelFr: 'Message Slack',
    description: 'Post a message to a Slack channel',
    descriptionFr: 'Publier un message sur un canal Slack',
    icon: MessageCircle,
    color: 'text-rose-600',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/40',
    defaultConfig: { token: '', channel: '', message: '' },
  },
  {
    id: 'WHATSAPP',
    label: 'WhatsApp',
    labelFr: 'WhatsApp',
    description: 'Send a WhatsApp message via Cloud API',
    descriptionFr: 'Envoyer un message WhatsApp via Cloud API',
    icon: Phone,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/40',
    defaultConfig: { token: '', phoneNumberId: '', to: '', message: '' },
  },
  {
    id: 'SHELL',
    label: 'Shell Execute',
    labelFr: 'Script Shell',
    description: 'Execute a shell command locally',
    descriptionFr: 'Exécuter une commande shell localement',
    icon: Terminal,
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/40',
    defaultConfig: { command: 'echo "Hello World"', timeout: 30000 },
  },
];

export const getNodeTypeMeta = (type: NodeTypeId | string): NodeTypeMeta =>
  NODE_TYPE_REGISTRY.find((n) => n.id === type) ?? NODE_TYPE_REGISTRY[0];
