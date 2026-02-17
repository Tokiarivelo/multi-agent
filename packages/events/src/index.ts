// Event Contracts for Multi-Agent Platform
// All events follow a consistent structure for event-driven architecture

import { ExecutionStatus, NodeType } from '@multi-agent/types';

// Base Event Interface
export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  version: string;
}

// Event Subjects (NATS topic structure)
export const EventSubjects = {
  // Workflow Events
  WORKFLOW_CREATED: 'workflow.created',
  WORKFLOW_UPDATED: 'workflow.updated',
  WORKFLOW_DELETED: 'workflow.deleted',
  WORKFLOW_EXECUTION_REQUESTED: 'workflow.execution.requested',
  
  // Execution Events
  EXECUTION_STARTED: 'execution.started',
  EXECUTION_NODE_STARTED: 'execution.node.started',
  EXECUTION_NODE_COMPLETED: 'execution.node.completed',
  EXECUTION_NODE_FAILED: 'execution.node.failed',
  EXECUTION_COMPLETED: 'execution.completed',
  EXECUTION_FAILED: 'execution.failed',
  EXECUTION_CANCELLED: 'execution.cancelled',
  
  // Agent Events
  AGENT_CREATED: 'agent.created',
  AGENT_UPDATED: 'agent.updated',
  AGENT_DELETED: 'agent.deleted',
  AGENT_EXECUTION_REQUESTED: 'agent.execution.requested',
  AGENT_EXECUTION_COMPLETED: 'agent.execution.completed',
  AGENT_EXECUTION_FAILED: 'agent.execution.failed',
  
  // Tool Events
  TOOL_CREATED: 'tool.created',
  TOOL_UPDATED: 'tool.updated',
  TOOL_DELETED: 'tool.deleted',
  TOOL_EXECUTION_REQUESTED: 'tool.execution.requested',
  TOOL_EXECUTION_COMPLETED: 'tool.execution.completed',
  TOOL_EXECUTION_FAILED: 'tool.execution.failed',
  
  // Model Events
  MODEL_CREATED: 'model.created',
  MODEL_UPDATED: 'model.updated',
  MODEL_DELETED: 'model.deleted',
  MODEL_INFERENCE_REQUESTED: 'model.inference.requested',
  MODEL_INFERENCE_COMPLETED: 'model.inference.completed',
  MODEL_INFERENCE_FAILED: 'model.inference.failed',
  MODEL_TOKEN_STREAM: 'model.token.stream',
  
  // Vector Events
  VECTOR_COLLECTION_CREATED: 'vector.collection.created',
  VECTOR_DOCUMENT_UPSERTED: 'vector.document.upserted',
  VECTOR_SEARCH_REQUESTED: 'vector.search.requested',
  VECTOR_SEARCH_COMPLETED: 'vector.search.completed',
} as const;

// Workflow Events
export interface WorkflowCreatedEvent extends BaseEvent {
  eventType: typeof EventSubjects.WORKFLOW_CREATED;
  data: {
    workflowId: string;
    userId: string;
    name: string;
    description?: string;
  };
}

export interface WorkflowExecutionRequestedEvent extends BaseEvent {
  eventType: typeof EventSubjects.WORKFLOW_EXECUTION_REQUESTED;
  data: {
    workflowId: string;
    userId: string;
    executionId: string;
    input?: Record<string, any>;
  };
}

// Execution Events
export interface ExecutionStartedEvent extends BaseEvent {
  eventType: typeof EventSubjects.EXECUTION_STARTED;
  data: {
    executionId: string;
    workflowId: string;
    userId: string;
    startedAt: Date;
  };
}

export interface ExecutionNodeStartedEvent extends BaseEvent {
  eventType: typeof EventSubjects.EXECUTION_NODE_STARTED;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: NodeType;
    input?: Record<string, any>;
    startedAt: Date;
  };
}

export interface ExecutionNodeCompletedEvent extends BaseEvent {
  eventType: typeof EventSubjects.EXECUTION_NODE_COMPLETED;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: NodeType;
    output: Record<string, any>;
    completedAt: Date;
    duration: number;
  };
}

export interface ExecutionNodeFailedEvent extends BaseEvent {
  eventType: typeof EventSubjects.EXECUTION_NODE_FAILED;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: NodeType;
    error: string;
    failedAt: Date;
  };
}

export interface ExecutionCompletedEvent extends BaseEvent {
  eventType: typeof EventSubjects.EXECUTION_COMPLETED;
  data: {
    executionId: string;
    workflowId: string;
    userId: string;
    status: ExecutionStatus;
    completedAt: Date;
    duration: number;
  };
}

export interface ExecutionFailedEvent extends BaseEvent {
  eventType: typeof EventSubjects.EXECUTION_FAILED;
  data: {
    executionId: string;
    workflowId: string;
    userId: string;
    error: string;
    failedAt: Date;
  };
}

// Agent Events
export interface AgentExecutionRequestedEvent extends BaseEvent {
  eventType: typeof EventSubjects.AGENT_EXECUTION_REQUESTED;
  data: {
    agentId: string;
    userId: string;
    executionId: string;
    nodeId: string;
    input: {
      prompt: string;
      context?: Record<string, any>;
    };
  };
}

export interface AgentExecutionCompletedEvent extends BaseEvent {
  eventType: typeof EventSubjects.AGENT_EXECUTION_COMPLETED;
  data: {
    agentId: string;
    executionId: string;
    nodeId: string;
    output: {
      response: string;
      metadata?: Record<string, any>;
    };
    tokensUsed?: number;
    duration: number;
  };
}

export interface AgentExecutionFailedEvent extends BaseEvent {
  eventType: typeof EventSubjects.AGENT_EXECUTION_FAILED;
  data: {
    agentId: string;
    executionId: string;
    nodeId: string;
    error: string;
  };
}

// Tool Events
export interface ToolExecutionRequestedEvent extends BaseEvent {
  eventType: typeof EventSubjects.TOOL_EXECUTION_REQUESTED;
  data: {
    toolId: string;
    executionId: string;
    nodeId: string;
    parameters: Record<string, any>;
  };
}

export interface ToolExecutionCompletedEvent extends BaseEvent {
  eventType: typeof EventSubjects.TOOL_EXECUTION_COMPLETED;
  data: {
    toolId: string;
    executionId: string;
    nodeId: string;
    result: any;
    duration: number;
  };
}

export interface ToolExecutionFailedEvent extends BaseEvent {
  eventType: typeof EventSubjects.TOOL_EXECUTION_FAILED;
  data: {
    toolId: string;
    executionId: string;
    nodeId: string;
    error: string;
  };
}

// Model Events
export interface ModelInferenceRequestedEvent extends BaseEvent {
  eventType: typeof EventSubjects.MODEL_INFERENCE_REQUESTED;
  data: {
    modelId: string;
    executionId: string;
    nodeId: string;
    prompt: string;
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    };
  };
}

export interface ModelInferenceCompletedEvent extends BaseEvent {
  eventType: typeof EventSubjects.MODEL_INFERENCE_COMPLETED;
  data: {
    modelId: string;
    executionId: string;
    nodeId: string;
    response: string;
    tokensUsed?: number;
    duration: number;
  };
}

export interface ModelTokenStreamEvent extends BaseEvent {
  eventType: typeof EventSubjects.MODEL_TOKEN_STREAM;
  data: {
    modelId: string;
    executionId: string;
    nodeId: string;
    token: string;
    isComplete: boolean;
  };
}

// Vector Events
export interface VectorSearchRequestedEvent extends BaseEvent {
  eventType: typeof EventSubjects.VECTOR_SEARCH_REQUESTED;
  data: {
    collectionId: string;
    userId: string;
    query: string;
    limit?: number;
  };
}

export interface VectorSearchCompletedEvent extends BaseEvent {
  eventType: typeof EventSubjects.VECTOR_SEARCH_COMPLETED;
  data: {
    collectionId: string;
    results: Array<{
      id: string;
      content: string;
      score: number;
      metadata: Record<string, any>;
    }>;
  };
}

// Union type of all events
export type DomainEvent =
  | WorkflowCreatedEvent
  | WorkflowExecutionRequestedEvent
  | ExecutionStartedEvent
  | ExecutionNodeStartedEvent
  | ExecutionNodeCompletedEvent
  | ExecutionNodeFailedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | AgentExecutionRequestedEvent
  | AgentExecutionCompletedEvent
  | AgentExecutionFailedEvent
  | ToolExecutionRequestedEvent
  | ToolExecutionCompletedEvent
  | ToolExecutionFailedEvent
  | ModelInferenceRequestedEvent
  | ModelInferenceCompletedEvent
  | ModelTokenStreamEvent
  | VectorSearchRequestedEvent
  | VectorSearchCompletedEvent;

// Dead Letter Queue Event
export interface DeadLetterEvent {
  originalEvent: DomainEvent;
  failureReason: string;
  failureCount: number;
  firstFailureAt: Date;
  lastFailureAt: Date;
}
