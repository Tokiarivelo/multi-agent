import { Injectable, Logger } from '@nestjs/common';

export interface TokenStreamEvent {
  type: 'token' | 'complete' | 'error';
  data?: string;
  metadata?: any;
}

@Injectable()
export class TokenStreamHandler {
  private readonly logger = new Logger(TokenStreamHandler.name);

  createStreamCallback(
    onToken: (token: string) => void,
    onComplete?: (data: any) => void,
    onError?: (error: Error) => void,
  ) {
    return {
      handleLLMNewToken: (token: string) => {
        try {
          onToken(token);
        } catch (error) {
          this.logger.error(`Error in token callback: ${error.message}`);
        }
      },
      handleLLMEnd: (output: any) => {
        try {
          if (onComplete) {
            onComplete(output);
          }
        } catch (error) {
          this.logger.error(`Error in complete callback: ${error.message}`);
        }
      },
      handleLLMError: (error: Error) => {
        try {
          this.logger.error(`LLM Error: ${error.message}`);
          if (onError) {
            onError(error);
          }
        } catch (err) {
          this.logger.error(`Error in error callback: ${err.message}`);
        }
      },
    };
  }

  formatStreamEvent(event: TokenStreamEvent): string {
    return JSON.stringify(event);
  }

  parseStreamEvent(data: string): TokenStreamEvent {
    try {
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Failed to parse stream event: ${error.message}`);
      return { type: 'error', data: 'Invalid stream data' };
    }
  }
}
