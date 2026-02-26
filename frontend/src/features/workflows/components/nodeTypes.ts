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
  | 'FILE';

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
];

export const getNodeTypeMeta = (type: NodeTypeId | string): NodeTypeMeta =>
  NODE_TYPE_REGISTRY.find((n) => n.id === type) ?? NODE_TYPE_REGISTRY[0];
