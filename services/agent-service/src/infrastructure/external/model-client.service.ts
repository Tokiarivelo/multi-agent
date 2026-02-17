import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  supportedFeatures?: string[];
}

@Injectable()
export class ModelClientService {
  private readonly modelServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.modelServiceUrl = this.configService.get<string>('MODEL_SERVICE_URL', 'http://localhost:3001');
  }

  async getModelConfig(modelId: string): Promise<ModelConfig> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.modelServiceUrl}/api/models/${modelId}`),
      );
      
      const model = response.data;
      
      return {
        id: model.id,
        name: model.name,
        provider: model.provider,
        apiKey: model.apiKey,
        baseUrl: model.baseUrl,
        maxTokens: model.maxTokens,
        supportedFeatures: model.supportedFeatures,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new HttpException(
          `Model with ID ${modelId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      
      throw new HttpException(
        `Failed to fetch model configuration: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async listModels(): Promise<ModelConfig[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.modelServiceUrl}/api/models`),
      );
      
      return response.data.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        apiKey: model.apiKey,
        baseUrl: model.baseUrl,
        maxTokens: model.maxTokens,
        supportedFeatures: model.supportedFeatures,
      }));
    } catch (error) {
      throw new HttpException(
        `Failed to fetch models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
