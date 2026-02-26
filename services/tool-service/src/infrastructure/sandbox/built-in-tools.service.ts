import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class BuiltInToolsService {
  private readonly logger = new Logger(BuiltInToolsService.name);
  private readonly allowedDomains: string[];
  private readonly enableFileOps: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const domains = this.configService.get<string>('ALLOWED_DOMAINS', '*');
    this.allowedDomains = domains === '*' ? ['*'] : domains.split(',');
    this.enableFileOps = this.configService.get<boolean>('ENABLE_FILE_OPERATIONS', true);
  }

  async execute(toolName: string, parameters: Record<string, any>, _timeout: number): Promise<any> {
    switch (toolName) {
      case 'http_request':
        return this.httpRequest(parameters as any);
      case 'web_scraper':
        return this.webScraper(parameters as any);
      case 'json_parser':
        return this.jsonParser(parameters as any);
      case 'file_read':
        return this.fileRead(parameters as any);
      case 'file_write':
        return this.fileWrite(parameters as any);
      default:
        throw new Error(`Unknown built-in tool: ${toolName}`);
    }
  }

  private async httpRequest(params: { url: string; method?: string; headers?: any; body?: any }): Promise<any> {
    const { url, method = 'GET', headers = {}, body } = params;

    if (!this.isAllowedDomain(url)) {
      throw new Error(`Domain not allowed: ${url}`);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url,
          method,
          headers,
          data: body,
          timeout: 10000,
        }),
      );

      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
      throw new Error(`HTTP request failed: ${error.message}`);
    }
  }

  private async webScraper(params: { url: string; selector?: string }): Promise<any> {
    const { url, selector } = params;

    if (!this.isAllowedDomain(url)) {
      throw new Error(`Domain not allowed: ${url}`);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: 10000 }),
      );

      const $ = cheerio.load(response.data);

      if (selector) {
        const elements = $(selector);
        const results: any[] = [];
        elements.each((_, el) => {
          results.push({
            text: $(el).text().trim(),
            html: $(el).html(),
            attributes: $(el).attr(),
          });
        });
        return results;
      }

      return {
        title: $('title').text(),
        text: $('body').text().trim(),
      };
    } catch (error) {
      throw new Error(`Web scraping failed: ${error.message}`);
    }
  }

  private jsonParser(params: { json: string }): any {
    try {
      return JSON.parse(params.json);
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }

  private async fileRead(params: { path: string }): Promise<string> {
    if (!this.enableFileOps) {
      throw new Error('File operations are disabled');
    }

    try {
      const content = await fs.readFile(params.path, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`File read failed: ${error.message}`);
    }
  }

  private async fileWrite(params: { path: string; content: string }): Promise<void> {
    if (!this.enableFileOps) {
      throw new Error('File operations are disabled');
    }

    try {
      const dir = path.dirname(params.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(params.path, params.content, 'utf-8');
    } catch (error) {
      throw new Error(`File write failed: ${error.message}`);
    }
  }

  private isAllowedDomain(url: string): boolean {
    if (this.allowedDomains.includes('*')) {
      return true;
    }

    try {
      const urlObj = new URL(url);
      return this.allowedDomains.some((domain) => urlObj.hostname.endsWith(domain));
    } catch {
      return false;
    }
  }
}
