import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

/**
 * Centralized factory for creating LLM provider SDK clients.
 *
 * - Avoids duplicating client construction across services.
 * - SDK clients are lightweight and ephemeral (created per API-key),
 *   so we don't cache them — the key may differ between calls.
 */
@Injectable()
export class ProviderClientFactory {
  /**
   * Create an OpenAI SDK client bound to the given API key.
   */
  createOpenAIClient(apiKey: string, timeout = 10_000): OpenAI {
    return new OpenAI({ apiKey, timeout });
  }

  /**
   * Create an Anthropic SDK client bound to the given API key.
   */
  createAnthropicClient(apiKey: string, timeout = 10_000): Anthropic {
    return new Anthropic({ apiKey, timeout });
  }

  /**
   * Create a Google GenAI SDK client bound to the given API key.
   */
  createGoogleClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({ apiKey });
  }
}
