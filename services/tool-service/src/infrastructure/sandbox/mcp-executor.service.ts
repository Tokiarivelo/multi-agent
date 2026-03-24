import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { McpConfig } from '@domain/tool.entity';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
    [key: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
}

@Injectable()
export class McpExecutorService {
  private readonly logger = new Logger(McpExecutorService.name);
  private rpcId = 1;

  constructor(private readonly httpService: HttpService) {}

  async execute(
    config: McpConfig,
    parameters: Record<string, unknown>,
    timeout: number,
  ): Promise<unknown> {
    const id = this.rpcId++;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: config.toolName, arguments: parameters },
    };

    this.logger.log(`MCP call → ${config.serverUrl} tool="${config.toolName}" transport=${config.transport}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post<JsonRpcResponse>(config.serverUrl, request, {
          headers: {
            'Content-Type': 'application/json',
            ...(config.headers ?? {}),
          },
          timeout,
        }),
      );

      const rpc = response.data;

      if (rpc.error) {
        throw new Error(`MCP error ${rpc.error.code}: ${rpc.error.message}`);
      }

      if (!rpc.result) {
        return null;
      }

      // Unwrap content array if present (standard MCP text/image content blocks)
      if (Array.isArray(rpc.result.content)) {
        const texts = rpc.result.content
          .filter((c) => c.type === 'text' && c.text !== undefined)
          .map((c) => c.text as string);

        if (texts.length === 1) return texts[0];
        if (texts.length > 1) return texts;
      }

      return rpc.result;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message ?? error.message;
      throw new Error(`MCP execution failed: ${msg}`);
    }
  }
}
