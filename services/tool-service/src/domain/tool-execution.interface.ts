export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
}

export interface ToolExecutionContext {
  toolId: string;
  parameters: Record<string, any>;
  timeout?: number;
  userId?: string;
}

export interface SandboxExecutor {
  execute(code: string, context: Record<string, any>, timeout: number): Promise<any>;
}
