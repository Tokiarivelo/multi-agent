import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ToolExecutionRequest {
  toolId?: string;
  toolName?: string;
  input: any;
  config?: Record<string, any>;
}

export interface ToolExecutionResponse {
  success: boolean;
  output: any;
  error?: string;
}

@Injectable()
export class ToolClientService {
  private readonly logger = new Logger(ToolClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('TOOL_SERVICE_URL')!;
  }

  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    try {
      this.logger.log(`Executing tool ${request.toolId || request.toolName}`);

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/api/tools/execute`, {
          toolId: request.toolId,
          toolName: request.toolName,
          parameters:
            typeof request.input === 'object' ? request.input : { default: request.input },
          timeout: request.config?.timeout,
        }),
      );

      this.logger.log(`Tool ${request.toolId || request.toolName} executed successfully`);
      return {
        success: true,
        output: response.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute tool ${request.toolId || request.toolName}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getToolInfo(toolId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/tools/${toolId}`),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get tool info ${toolId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
