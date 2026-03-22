import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FileSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
}

@Injectable()
export class VectorClientService {
  private readonly logger = new Logger(VectorClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('VECTOR_SERVICE_URL', 'http://localhost:3005');
  }

  /**
   * Search indexed workspace files by natural language query.
   * Returns the top-K most relevant chunks (score >= minScore).
   */
  async searchFiles(
    userId: string,
    query: string,
    limit = 5,
    fileId?: string,
    minScore = 0.3,
  ): Promise<FileSearchResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}/vectors/search-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query, limit, fileId }),
      });

      if (!res.ok) {
        this.logger.warn(`Vector search failed (${res.status}) — skipping RAG context`);
        return [];
      }

      const data = (await res.json()) as { results: FileSearchResult[] };
      return data.results.filter((r) => r.score >= minScore);
    } catch (err) {
      this.logger.warn(`Vector search error: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /**
   * Format retrieved chunks into a compact context block to prepend to the conversation.
   * Keeps total characters under maxChars to minimise token usage.
   */
  buildContextBlock(results: FileSearchResult[], maxChars = 6000): string {
    if (results.length === 0) return '';
    let block = '=== Relevant file context (retrieved from workspace) ===\n';
    let used = block.length;
    for (const r of results) {
      const fileName = (r.metadata.fileName as string | undefined) ?? 'unknown';
      const header = `\n--- ${fileName} (score: ${r.score.toFixed(2)}) ---\n`;
      const body = r.content.slice(0, maxChars - used - header.length);
      if (body.length <= 0) break;
      block += header + body;
      used += header.length + body.length;
      if (used >= maxChars) break;
    }
    block += '\n=== End of file context ===\n';
    return block;
  }
}
