import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ToolExecutionRequest {
  toolId: string;
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
      this.logger.log(`Executing tool ${request.toolId}`);

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/tools/execute`, {
          toolId: request.toolId,
          input: request.input,
          config: request.config,
        }),
      );

      this.logger.log(`Tool ${request.toolId} executed successfully`);
      return {
        success: true,
        output: response.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute tool ${request.toolId}`,
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
        this.httpService.get(`${this.baseUrl}/tools/${toolId}`),
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
