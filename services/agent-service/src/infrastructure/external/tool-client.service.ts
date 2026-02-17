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

@Injectable()
export class ToolClientService {
  private readonly toolServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.toolServiceUrl = this.configService.get<string>('TOOL_SERVICE_URL', 'http://localhost:3003');
  }

  async getTools(toolIds: string[]): Promise<any[]> {
    try {
      const toolPromises = toolIds.map(id => this.getTool(id));
      const tools = await Promise.all(toolPromises);
      
      return tools.map(tool => this.convertToLangChainTool(tool));
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
        throw new HttpException(
          `Tool with ID ${toolId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      
      throw new HttpException(
        `Failed to fetch tool: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async executeTool(toolId: string, parameters: Record<string, any>): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.toolServiceUrl}/api/tools/${toolId}/execute`, {
          parameters,
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

  private convertToLangChainTool(tool: ToolDefinition): any {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }
}
