import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  endpoint?: string;
}

export interface ToolSummary {
  id: string;
  name: string;
  description: string;
  category: string;
}

@Injectable()
export class ToolClientService {
  private readonly toolServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.toolServiceUrl = this.configService.get<string>(
      'TOOL_SERVICE_URL',
      'http://localhost:3006',
    );
  }

  async getTools(toolIds: string[]): Promise<any[]> {
    try {
      const toolPromises = toolIds.map((id) => this.getTool(id));
      const tools = await Promise.all(toolPromises);

      return tools.map((tool) => this.convertToLangChainTool(tool));
    } catch (error) {
      throw new HttpException(
        `Failed to fetch tools: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTool(toolId: string): Promise<ToolDefinition> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.toolServiceUrl}/api/tools/${toolId}`),
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new HttpException(`Tool with ID ${toolId} not found`, HttpStatus.NOT_FOUND);
      }

      throw new HttpException(
        `Failed to fetch tool: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async listToolsCatalog(pageSize = 200): Promise<ToolSummary[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.toolServiceUrl}/api/tools`, {
          params: { page: 1, pageSize },
        }),
      );
      return response.data?.data ?? [];
    } catch {
      return [];
    }
  }

  async createTool(dto: {
    name: string;
    description: string;
    category: string;
    parameters: unknown[];
    code?: string;
    icon?: string;
  }): Promise<{ id: string; name: string }> {
    const response = await firstValueFrom(
      this.httpService.post(`${this.toolServiceUrl}/api/tools`, dto),
    );
    return { id: response.data.id, name: response.data.name };
  }

  async generateToolWithAi(
    prompt: string,
    modelId: string,
  ): Promise<{
    name: string;
    description: string;
    category: string;
    parameters: unknown[];
    code?: string;
    icon?: string;
  } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.toolServiceUrl}/api/tools/ai/generate`, {
          prompt,
          modelId,
        }),
      );
      return response.data?.config ?? null;
    } catch {
      return null;
    }
  }

  async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    userId?: string,
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.toolServiceUrl}/api/tools/execute`, {
          toolName,
          parameters,
          ...(userId ? { userId } : {}),
        }),
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        `Failed to execute tool: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private convertToLangChainTool(tool: ToolDefinition): Record<string, unknown> {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.convertParametersToJsonSchema(tool.parameters),
      },
    };
  }

  /**
   * Convert the array-based parameter format stored in the DB
   * into a proper JSON Schema object expected by LLM providers.
   *
   * DB format:   [{ name, type, required, description, default? }]
   * JSON Schema: { type: 'object', properties: {...}, required: [...] }
   */
  private convertParametersToJsonSchema(
    parameters: Record<string, any> | any[] | null | undefined,
  ): Record<string, any> {
    // Already a valid JSON Schema object (has "type" key)
    if (parameters && !Array.isArray(parameters) && parameters.type) {
      return parameters;
    }

    // Array of parameter definitions → convert to JSON Schema
    if (Array.isArray(parameters) && parameters.length > 0) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const param of parameters) {
        properties[param.name] = {
          type: param.type || 'string',
          description: param.description || '',
        };

        if (param.default !== undefined) {
          properties[param.name].default = param.default;
        }

        if (param.required) {
          required.push(param.name);
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }

    // Fallback: empty schema
    return {
      type: 'object',
      properties: {},
    };
  }
}
