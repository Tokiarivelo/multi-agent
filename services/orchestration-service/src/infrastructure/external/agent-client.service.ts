import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface AgentExecutionRequest {
  agentId: string;
  input: any;
  config?: Record<string, any>;
}

export interface AgentExecutionResponse {
  success: boolean;
  output: any;
  error?: string;
}

@Injectable()
export class AgentClientService {
  private readonly logger = new Logger(AgentClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('AGENT_SERVICE_URL')!;
  }

  async executeAgent(request: AgentExecutionRequest): Promise<AgentExecutionResponse> {
    try {
      this.logger.log(`Executing agent ${request.agentId}`);

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/agents/execute`, {
          agentId: request.agentId,
          input: request.input,
          config: request.config,
        }),
      );

      this.logger.log(`Agent ${request.agentId} executed successfully`);
      return {
        success: true,
        output: response.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute agent ${request.agentId}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAgentStatus(agentId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/agents/${agentId}`),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get agent status ${agentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
