/**
 * MCP (Model Context Protocol) Controller
 *
 * Exposes tools registered in the tool-service as MCP-compliant endpoints.
 * Clients include AI IDEs (Cursor, Claude Desktop), custom MCP clients, and
 * any other system that speaks the MCP JSON-RPC 2.0 protocol.
 *
 * Spec reference: https://spec.modelcontextprotocol.io/specification/
 *
 * Endpoints implemented:
 *   POST /mcp            – JSON-RPC dispatch (initialize, tools/list, tools/call)
 *   GET  /mcp/health     – liveness check
 *   GET  /mcp/tools      – convenience REST list (non-standard, for debugging)
 */

import { Controller, Post, Get, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ToolClientService } from '../../infrastructure/external/tool-client.service';

// ─── MCP JSON-RPC types ───────────────────────────────────────────────────────
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, any>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

// ─── MCP protocol version this server speaks ─────────────────────────────────
const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'multi-agent-mcp-server';
const SERVER_VERSION = '1.0.0';

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly toolClient: ToolClientService) {}

  // ── Health ──────────────────────────────────────────────────────────────────
  @Get('health')
  health() {
    return { status: 'ok', server: SERVER_NAME, version: SERVER_VERSION, protocol: MCP_VERSION };
  }

  // ── Convenience REST list (non-MCP, for quick debugging) ───────────────────
  @Get('tools')
  async listToolsRest() {
    // We can't easily enumerate all tools without IDs — return server info instead
    return {
      server: SERVER_NAME,
      protocol: MCP_VERSION,
      note: 'Use POST /mcp with JSON-RPC to list or call tools.',
    };
  }

  // ── JSON-RPC 2.0 dispatcher ─────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.OK)
  async dispatch(@Body() req: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logger.debug(`MCP request: ${req.method} (id=${req.id})`);

    try {
      const result = await this.handleMethod(req.method, req.params ?? {});
      return { jsonrpc: '2.0', id: req.id ?? null, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`MCP error for ${req.method}: ${message}`);
      return {
        jsonrpc: '2.0',
        id: req.id ?? null,
        error: { code: -32000, message },
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  private async handleMethod(method: string, params: Record<string, any>): Promise<any> {
    switch (method) {
      // ── initialize ────────────────────────────────────────────────────────────
      case 'initialize':
        return {
          protocolVersion: MCP_VERSION,
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        };

      // ── notifications/initialized ─────────────────────────────────────────────
      case 'notifications/initialized':
        return {}; // no-op acknowledgement

      // ── tools/list ────────────────────────────────────────────────────────────
      case 'tools/list': {
        /*
         * The MCP spec expects a flat list of tool descriptors.
         * We expose all tool IDs provided via `params.toolIds` (optional filter).
         * Without a filter we cannot enumerate all tools cheaply — clients should
         * pass the IDs they know about.
         */
        const toolIds: string[] = Array.isArray(params.toolIds) ? params.toolIds : [];

        if (toolIds.length === 0) {
          return { tools: [] };
        }

        const rawTools = await Promise.all(toolIds.map((id) => this.toolClient.getTool(id)));
        const tools = rawTools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.parameters ?? { type: 'object', properties: {} },
        }));

        return { tools };
      }

      // ── tools/call ────────────────────────────────────────────────────────────
      case 'tools/call': {
        /*
         * params:
         *   name       – tool name (we look up by name)
         *   arguments  – key/value map of tool inputs
         *   _toolId    – optional direct tool ID (non-standard shortcut)
         */
        const { name, arguments: args = {}, _toolId } = params;

        if (!name && !_toolId) {
          throw new Error('tools/call requires either "name" or "_toolId" param');
        }

        const toolId = _toolId as string | undefined;

        // Resolve name → id if only name given
        if (!toolId && name) {
          // We need to fetch by name. The tool-service exposes GET /api/tools?name=…
          // Use getTool via the client (which fetches by ID), so we need the caller to provide _toolId
          // or we could search — for now require _toolId when name-only lookup is needed
          throw new Error(
            'Provide "_toolId" alongside "name" — name-only lookup is not supported yet. ' +
              'Use tools/list to discover IDs.',
          );
        }

        const result = await this.toolClient.executeTool(toolId!, args);

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
          isError: false,
        };
      }

      // ── ping ──────────────────────────────────────────────────────────────────
      case 'ping':
        return {};

      default:
        throw new Error(`Unknown MCP method: ${method} (-32601)`);
    }
  }
}
