import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BuiltInToolsService {
  private readonly logger = new Logger(BuiltInToolsService.name);
  private readonly allowedDomains: string[];
  private readonly enableFileOps: boolean;

  private readonly workspaceRoot: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const domains = this.configService.get<string>('ALLOWED_DOMAINS', '*');
    this.allowedDomains = domains === '*' ? ['*'] : domains.split(',');
    this.enableFileOps = this.configService.get<boolean>('ENABLE_FILE_OPERATIONS', true);
    
    // Default workspace root is two levels up if in dev (multi-agent/services/tool-service)
    // or current directory if elsewhere. Can be overridden by WORKSPACE_ROOT env.
    const defaultRoot = path.resolve(process.cwd(), process.env.NODE_ENV === 'development' ? '../..' : '.');
    this.workspaceRoot = this.configService.get<string>('WORKSPACE_ROOT') || defaultRoot;
    
    this.logger.log(`Workspace root initialized to: ${this.workspaceRoot}`);
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
      case 'pdf_read':
        return this.pdfRead(parameters as any);
      case 'file_write':
        return this.fileWrite(parameters as any);
      case 'workspace_read':
        return this.workspaceRead(parameters as any);
      case 'workspace_write':
        return this.workspaceWrite(parameters as any);
      case 'github_api':
        return this.githubApi(parameters as any);
      case 'slack_post_message':
        return this.slackPostMessage(parameters as any);
      case 'whatsapp_send_message':
        return this.whatsappSendMessage(parameters as any);
      case 'shell_execute':
        return this.shellExecute(parameters as any);
      case 'git_status':
        return this.gitStatus(parameters as any);
      case 'git_add':
        return this.gitAdd(parameters as any);
      case 'git_commit':
        return this.gitCommit(parameters as any);
      case 'git_push':
        return this.gitPush(parameters as any);
      case 'git_pull':
        return this.gitPull(parameters as any);
      case 'git_branch_create':
        return this.gitBranchCreate(parameters as any);
      case 'trello_create_card':
        return this.trelloCreateCard(parameters as any);
      case 'trello_get_lists':
        return this.trelloGetLists(parameters as any);
      case 'trello_move_card':
        return this.trelloMoveCard(parameters as any);
      default:
        throw new Error(`Unknown built-in tool: ${toolName}`);
    }
  }

  private async httpRequest(params: {
    url: string;
    method?: string;
    headers?: any;
    body?: any;
  }): Promise<any> {
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
      const response = await firstValueFrom(this.httpService.get(url, { timeout: 10000 }));

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

  private async fileRead(params: { path: string; cwd?: string }): Promise<{
    success: boolean;
    content: string;
    path: string;
  }> {
    if (!this.enableFileOps) {
      throw new Error('File operations are disabled');
    }

    const basePath = params.cwd
      ? path.isAbsolute(params.cwd)
        ? params.cwd
        : path.resolve(this.workspaceRoot, params.cwd)
      : this.workspaceRoot;

    const resolvedPath = path.isAbsolute(params.path)
      ? params.path
      : path.resolve(basePath, params.path);

    try {
      this.logger.log(`Reading file: ${resolvedPath}`);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return { success: true, content, path: resolvedPath };
    } catch (error) {
      throw new Error(`File read failed for "${resolvedPath}": ${error.message}`);
    }
  }

  private async pdfRead(params: { path: string; cwd?: string }): Promise<{
    success: boolean;
    content: string;
    pages: number;
    info: object;
    path: string;
  }> {
    if (!this.enableFileOps) {
      throw new Error('File operations are disabled');
    }

    const basePath = params.cwd
      ? path.isAbsolute(params.cwd)
        ? params.cwd
        : path.resolve(this.workspaceRoot, params.cwd)
      : this.workspaceRoot;

    const resolvedPath = path.isAbsolute(params.path)
      ? params.path
      : path.resolve(basePath, params.path);

    try {
      this.logger.log(`Reading PDF: ${resolvedPath}`);
      const buffer = await fs.readFile(resolvedPath);
      const data = await pdfParse(buffer);
      return {
        success: true,
        content: data.text,
        pages: data.numpages,
        info: data.info ?? {},
        path: resolvedPath,
      };
    } catch (error) {
      throw new Error(`PDF read failed for "${resolvedPath}": ${error.message}`);
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

  private async workspaceRead(params: {
    filePath: string;
    workspaceId?: string;
  }): Promise<{ success: boolean; content: string; path: string }> {
    return this.fileRead({ path: params.filePath });
  }

  private async workspaceWrite(params: {
    filePath: string;
    content: string;
    workspaceId?: string;
  }): Promise<{ success: boolean; path: string }> {
    const resolvedPath = this.resolvePath(params.filePath);
    await this.fileWrite({ path: resolvedPath, content: params.content });
    return { success: true, path: resolvedPath };
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

  // --- Integrations & Shell ---

  private async githubApi(params: {
    token: string;
    endpoint: string;
    method?: string;
    body?: any;
  }): Promise<any> {
    const { token, endpoint, method = 'GET', body } = params;
    const url = endpoint.startsWith('http')
      ? endpoint
      : `https://api.github.com${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url,
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'MultiAgent-System',
          },
          data: body,
          timeout: 15000,
        }),
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`GitHub API failed: ${error.response?.data?.message || error.message}`);
    }
  }

  private async slackPostMessage(params: {
    token: string;
    channel: string;
    text: string;
  }): Promise<any> {
    const { token, channel, text } = params;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://slack.com/api/chat.postMessage',
          { channel, text },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
        ),
      );
      if (!response.data.ok) throw new Error(response.data.error);
      return response.data;
    } catch (error: any) {
      throw new Error(`Slack post failed: ${error.response?.data?.error || error.message}`);
    }
  }

  private async whatsappSendMessage(params: {
    token: string;
    phoneNumberId: string;
    to: string;
    text: string;
  }): Promise<any> {
    const { token, phoneNumberId, to, text } = params;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
          },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        `WhatsApp send failed: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  private async shellExecute(params: {
    command: string;
    timeout?: number;
    cwd?: string;
  }): Promise<any> {
    if (!this.enableFileOps) {
      throw new Error('Shell operations are disabled by policy (ENABLE_FILE_OPERATIONS=false).');
    }
    try {
      if (!params.cwd) {
        this.logger.warn(`No 'cwd' provided for shell command, falling back to server default: ${this.workspaceRoot}`);
      }
      
      const execCwd = params.cwd
        ? path.isAbsolute(params.cwd)
          ? params.cwd
          : path.resolve(this.workspaceRoot, params.cwd)
        : this.workspaceRoot;

      this.logger.log(`Executing shell command in [${execCwd}]: ${params.command}`);

      const { stdout, stderr } = await execAsync(params.command, {
        timeout: params.timeout || 30000,
        cwd: execCwd,
      });
      return { stdout, stderr, code: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout,
        stderr: error.stderr,
        code: error.code || 1,
        error: error.message,
      };
    }
  }

  private async trelloCreateCard(params: {
    apiKey: string;
    token: string;
    listId: string;
    name: string;
    description?: string;
  }): Promise<any> {
    const { apiKey, token, listId, name, description } = params;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.trello.com/1/cards',
          null,
          {
            params: {
              key: apiKey,
              token,
              idList: listId,
              name,
              ...(description ? { desc: description } : {}),
            },
            timeout: 10000,
          },
        ),
      );
      return { success: true, card: response.data };
    } catch (error: any) {
      throw new Error(`Trello card creation failed: ${error.response?.data || error.message}`);
    }
  }

  private async trelloGetLists(params: {
    apiKey: string;
    token: string;
    boardId: string;
  }): Promise<any> {
    const { apiKey, token, boardId } = params;
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://api.trello.com/1/boards/${boardId}/lists`, {
          params: {
            key: apiKey,
            token,
          },
          timeout: 10000,
        }),
      );
      return response.data.map((list: any) => ({
        id: list.id,
        name: list.name,
      }));
    } catch (error: any) {
      throw new Error(`Trello get lists failed: ${error.response?.data || error.message}`);
    }
  }

  private async trelloMoveCard(params: {
    apiKey: string;
    token: string;
    listId: string;
    cardId?: string;
    cardName?: string;
    boardId?: string;
  }): Promise<any> {
    const { apiKey, token, listId, cardName, boardId } = params;
    let { cardId } = params;

    if (!cardId && !cardName) {
      throw new Error('Either cardId or cardName must be provided');
    }

    if (!cardId) {
      if (!boardId) throw new Error('boardId is required when using cardName');

      const listsResp = await firstValueFrom(
        this.httpService.get(`https://api.trello.com/1/boards/${boardId}/lists`, {
          params: { key: apiKey, token, cards: 'open', fields: 'id,name' },
          timeout: 10000,
        }),
      );

      const needle = cardName!.toLowerCase();
      let match: any = null;

      for (const list of listsResp.data) {
        const cards = await firstValueFrom(
          this.httpService.get(`https://api.trello.com/1/lists/${list.id}/cards`, {
            params: { key: apiKey, token, fields: 'id,name' },
            timeout: 10000,
          }),
        );
        const exact = cards.data.find((c: any) => c.name.toLowerCase() === needle);
        if (exact) { match = exact; break; }
        if (!match) {
          const partial = cards.data.find((c: any) => c.name.toLowerCase().includes(needle));
          if (partial) match = partial;
        }
      }

      if (!match) throw new Error(`Card not found with name: "${cardName}"`);
      cardId = match.id;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.put(
          `https://api.trello.com/1/cards/${cardId}`,
          null,
          { params: { key: apiKey, token, idList: listId }, timeout: 10000 },
        ),
      );
      return { success: true, card: { id: response.data.id, name: response.data.name, idList: response.data.idList } };
    } catch (error: any) {
      throw new Error(`Trello move card failed: ${error.response?.data || error.message}`);
    }
  }

  // --- Git Tools ---

  private async gitStatus(params: { cwd?: string }): Promise<any> {
    if (!this.enableFileOps) throw new Error('File operations are disabled');
    const cwd = this.resolvePath(params.cwd);
    return this.execGitCommand('git status', cwd);
  }

  private async gitAdd(params: { paths?: string | string[]; cwd?: string }): Promise<any> {
    if (!this.enableFileOps) throw new Error('File operations are disabled');
    const cwd = this.resolvePath(params.cwd);
    const paths = Array.isArray(params.paths) ? params.paths.join(' ') : params.paths || '.';
    return this.execGitCommand(`git add ${paths}`, cwd);
  }

  private async gitCommit(params: { message: string; cwd?: string }): Promise<any> {
    if (!this.enableFileOps) throw new Error('File operations are disabled');
    const cwd = this.resolvePath(params.cwd);
    return this.execGitCommand(`git commit -m "${params.message}"`, cwd);
  }

  private async gitPush(params: { remote?: string; branch?: string; cwd?: string }): Promise<any> {
    if (!this.enableFileOps) throw new Error('File operations are disabled');
    const cwd = this.resolvePath(params.cwd);
    const remote = params.remote || 'origin';
    const branch = params.branch || (await this.getCurrentBranch(cwd));
    return this.execGitCommand(`git push ${remote} ${branch}`, cwd);
  }

  private async gitPull(params: { remote?: string; branch?: string; cwd?: string }): Promise<any> {
    if (!this.enableFileOps) throw new Error('File operations are disabled');
    const cwd = this.resolvePath(params.cwd);
    const remote = params.remote || 'origin';
    const branch = params.branch || (await this.getCurrentBranch(cwd));
    return this.execGitCommand(`git pull ${remote} ${branch}`, cwd);
  }

  private async gitBranchCreate(params: {
    name: string;
    checkout?: boolean;
    cwd?: string;
  }): Promise<any> {
    if (!this.enableFileOps) throw new Error('File operations are disabled');
    const cwd = this.resolvePath(params.cwd);
    const command = params.checkout ? `git checkout -b ${params.name}` : `git branch ${params.name}`;
    return this.execGitCommand(command, cwd);
  }

  private async getCurrentBranch(cwd: string): Promise<string> {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
    return stdout.trim();
  }

  private resolvePath(relativeOrAbsolutePath?: string): string {
    if (!relativeOrAbsolutePath) return this.workspaceRoot;
    return path.isAbsolute(relativeOrAbsolutePath)
      ? relativeOrAbsolutePath
      : path.resolve(this.workspaceRoot, relativeOrAbsolutePath);
  }

  private async execGitCommand(command: string, cwd: string): Promise<any> {
    try {
      this.logger.log(`Executing Git command in [${cwd}]: ${command}`);
      const { stdout, stderr } = await execAsync(command, { cwd });
      return { stdout, stderr, code: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout,
        stderr: error.stderr,
        code: error.code || 1,
        error: error.message,
      };
    }
  }
}
