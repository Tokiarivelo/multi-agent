export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  installsCount: number;
  previewImageUrl: string | null;
  isFeatured: boolean;
  authorName: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail extends TemplateListItem {
  nodes: unknown;
  edges: unknown;
  definition: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTemplates {
  data: TemplateListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface InstalledTemplate {
  id: string;
  name: string;
  forkedFromId: string | null;
}

export interface PublishWorkflowPayload {
  workflowId: string;
  name?: string;
  description: string;
  category: string;
  tags?: string[];
  previewImageUrl?: string;
  isFeatured?: boolean;
}

export interface UpdatePublishedPayload {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  previewImageUrl?: string;
  isFeatured?: boolean;
}

export interface PublishedWorkflowResult {
  id: string;
  name: string;
  category: string | null;
  authorName: string | null;
  isTemplate: boolean;
}

export interface MyPublishedWorkflow {
  id: string;
  name: string;
  category: string | null;
  installsCount: number;
  isFeatured: boolean;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstallerRecord {
  installerId: string;
  email: string;
  firstName: string;
  lastName: string;
  installedAt: string;
}
