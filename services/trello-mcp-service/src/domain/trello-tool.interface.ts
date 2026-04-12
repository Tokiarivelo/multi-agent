export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      { type: string; description: string; default?: unknown; enum?: string[] }
    >;
    required: string[];
  };
}

export interface McpToolHandler {
  schema(): McpToolSchema;
  execute(args: Record<string, unknown>): Promise<McpToolResult>;
}

export interface McpContent {
  type: 'text';
  text: string;
}

export interface McpToolResult {
  content: McpContent[];
  isError?: boolean;
}

export function textResult(data: unknown): McpToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text', text }] };
}
