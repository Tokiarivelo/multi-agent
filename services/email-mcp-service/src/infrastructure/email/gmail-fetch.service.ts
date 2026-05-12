import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ImapFlow, FetchMessageObject, MessageStructureObject } from 'imapflow';
import { Readable } from 'stream';
import { firstValueFrom } from 'rxjs';

export interface FetchEmailsParams {
  mailbox?: string;
  limit?: number;
  query?: string;
  imapUser?: string;
  imapPass?: string;
  imapHost?: string;
  imapPort?: number;
}

export interface ManipulateEmailsParams {
  mailbox?: string;
  uids: number[];
  action: 'mark_read' | 'mark_unread' | 'move' | 'delete';
  targetMailbox?: string;
  imapUser?: string;
  imapPass?: string;
  imapHost?: string;
  imapPort?: number;
}

export interface FetchedEmail {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
}

export interface AttachmentInfo {
  partId: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface ListAttachmentsParams {
  uid: number;
  mailbox?: string;
  imapUser?: string;
  imapPass?: string;
  imapHost?: string;
  imapPort?: number;
}

export interface DownloadAttachmentParams extends ListAttachmentsParams {
  partId: string;
  savePath?: string;
}

export interface DownloadedAttachment {
  filename: string;
  contentType: string;
  size: number;
  data: string;
  encoding: 'base64';
  savedTo?: string;
  localPath?: string;
  url?: string;
}

@Injectable()
export class GmailFetchService {
  private readonly logger = new Logger(GmailFetchService.name);

  private readonly defaultImap: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  private readonly toolServiceUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.defaultImap = {
      host: this.config.get<string>('imap.host', 'imap.gmail.com'),
      port: this.config.get<number>('imap.port', 993),
      user: this.config.get<string>('imap.user', ''),
      pass: this.config.get<string>('imap.pass', ''),
    };
    this.toolServiceUrl = this.config.get<string>('toolServiceUrl', 'http://localhost:3030');
  }

  async fetchEmails(params: FetchEmailsParams = {}): Promise<FetchedEmail[]> {
    const mailbox = params.mailbox ?? 'INBOX';
    const limit = params.limit ?? 20;

    console.log('params :>> ', params);

    this.logger.log(`Fetching emails — mailbox: ${mailbox}, limit: ${limit}`);

    const client = this.buildClient(params);

    if (mailbox.includes('@')) {
      this.logger.warn(
        `Mailbox "${mailbox}" looks like an email address — defaulting to INBOX. Use an IMAP folder name (e.g. INBOX, [Gmail]/Sent Mail) instead.`,
      );
      return this.fetchEmails({ ...params, mailbox: 'INBOX' });
    }

    await client.connect();

    const results: FetchedEmail[] = [];

    try {
      let lock;
      try {
        lock = await client.getMailboxLock(mailbox);
      } catch {
        throw new Error(
          `Mailbox "${mailbox}" not found on the IMAP server. ` +
            `Common Gmail folders: INBOX, [Gmail]/Sent Mail, [Gmail]/Drafts, [Gmail]/Trash.`,
        );
      }
      try {
        const status = await client.status(mailbox, { messages: true });
        const total = status.messages ?? 0;

        if (total === 0) return results;

        let uids: number[];

        if (params.query) {
          const searched = await client.search(this.parseQuery(params.query), { uid: true });
          uids = (searched as number[]).slice(-limit).reverse();
        } else {
          const start = Math.max(1, total - limit + 1);
          const range = `${start}:${total}`;
          uids = [];
          for await (const msg of client.fetch(range, { uid: true })) {
            if (msg.uid !== undefined) uids.push(msg.uid);
          }
          uids.reverse();
        }

        if (uids.length === 0) return results;

        const uidRange = uids.join(',');
        for await (const msg of client.fetch(
          uidRange,
          { envelope: true, bodyParts: ['TEXT'] },
          { uid: true },
        )) {
          results.push(this.toFetchedEmail(msg));
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    this.logger.log(`Fetched ${results.length} emails from ${mailbox}`);
    return results;
  }

  async manipulateEmails(
    params: ManipulateEmailsParams,
  ): Promise<{ success: boolean; modified: number }> {
    const mailbox = params.mailbox ?? 'INBOX';
    this.logger.log(
      `Manipulating emails — mailbox: ${mailbox}, action: ${params.action}, uids: ${params.uids.join(',')}`,
    );
    const client = this.buildClient(params);

    await client.connect();

    try {
      const lock = await client.getMailboxLock(mailbox);
      try {
        const uidSequence = params.uids.join(',');
        if (!uidSequence) return { success: true, modified: 0 };

        switch (params.action) {
          case 'mark_read':
            await client.messageFlagsAdd(uidSequence, ['\\Seen'], { uid: true });
            break;
          case 'mark_unread':
            await client.messageFlagsRemove(uidSequence, ['\\Seen'], { uid: true });
            break;
          case 'move':
            if (!params.targetMailbox) throw new Error('targetMailbox is required for move action');
            await client.messageMove(uidSequence, params.targetMailbox, { uid: true });
            break;
          case 'delete':
            await client.messageFlagsAdd(uidSequence, ['\\Deleted'], { uid: true });
            break;
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return { success: true, modified: params.uids.length };
  }

  async listAttachments(params: ListAttachmentsParams): Promise<AttachmentInfo[]> {
    const mailbox = params.mailbox ?? 'INBOX';

    // Retry logic for transient network issues
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      // Create a fresh client for each attempt (ImapFlow cannot be reused)
      const client = this.buildClient(params);
      try {
        this.logger.debug(`Connecting to IMAP (attempt ${attempt}/3)...`);
        await client.connect();
        try {
          const lock = await client.getMailboxLock(mailbox);
          try {
            const msg = await client.fetchOne(
              String(params.uid),
              { bodyStructure: true },
              { uid: true },
            );
            if (!msg || !msg.bodyStructure) return [];
            const attachments: AttachmentInfo[] = [];
            this.collectAttachments(msg.bodyStructure, attachments);
            return attachments;
          } finally {
            lock.release();
          }
        } finally {
          await client.logout();
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `IMAP connection attempt ${attempt}/3 failed for listAttachments(uid=${params.uid}): ${lastError.message}`,
        );

        // Don't retry on auth errors
        if (
          lastError.message.includes('authentication') ||
          lastError.message.includes('Invalid credentials')
        ) {
          throw lastError;
        }

        // Wait before retry with exponential backoff
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw new Error(`Failed to list attachments after 3 attempts: ${lastError?.message}`);
  }

  async downloadAttachment(params: DownloadAttachmentParams): Promise<DownloadedAttachment> {
    const client = this.buildClient(params);
    const mailbox = params.mailbox ?? 'INBOX';

    await client.connect();
    try {
      const lock = await client.getMailboxLock(mailbox);
      try {
        const result = await client.download(String(params.uid), params.partId, { uid: true });
        if (!result) throw new Error(`Part ${params.partId} not found in message ${params.uid}`);

        const { meta, content } = result as {
          meta: { filename?: string; contentType?: string; expectedSize?: number };
          content: Readable;
        };
        const chunks: Buffer[] = [];
        for await (const chunk of content) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        }
        const buf = Buffer.concat(chunks);

        const filename = meta.filename ?? `attachment_${params.partId}`;
        const contentType = meta.contentType ?? 'application/octet-stream';
        const data = buf.toString('base64');

        if (params.savePath) {
          try {
            const resp = await firstValueFrom(
              this.http.post(`${this.toolServiceUrl}/api/tools/execute`, {
                toolName: 'download_file',
                parameters: {
                  content: data,
                  outputPath: params.savePath,
                  filename,
                  contentType,
                },
              }),
            );
            const result = resp.data?.data ?? resp.data ?? {};
            return {
              filename,
              contentType,
              size: buf.length,
              data,
              encoding: 'base64' as const,
              localPath: result.localPath as string | undefined,
              url: result.url as string | undefined,
            };
          } catch (err) {
            this.logger.warn(
              `download_file tool call failed, skipping save: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        return { filename, contentType, size: buf.length, data, encoding: 'base64' as const };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  private buildClient(params: {
    imapHost?: string;
    imapPort?: number;
    imapUser?: string;
    imapPass?: string;
  }): ImapFlow {
    const host = params.imapHost ?? this.defaultImap.host;
    const port = params.imapPort ?? this.defaultImap.port;
    const user = params.imapUser ?? this.defaultImap.user;
    const pass = params.imapPass ?? this.defaultImap.pass;

    if (!user || !pass) {
      throw new Error(
        'IMAP credentials not configured. Set IMAP_USER and IMAP_PASS env variables.',
      );
    }

    return new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass },
      logger: false,
      connectionTimeout: 30_000, // Increased from 10s to 30s
      greetingTimeout: 20_000, // Increased from 10s to 20s
      socketTimeout: 60_000, // Increased from 30s to 60s
    });
  }

  private collectAttachments(node: MessageStructureObject, parts: AttachmentInfo[]): void {
    if (node.childNodes) {
      for (const child of node.childNodes) {
        this.collectAttachments(child, parts);
      }
    }
    if (!node.part) return;

    const isAttachment =
      node.disposition?.toLowerCase() === 'attachment' ||
      node.dispositionParameters?.['filename'] !== undefined ||
      (node.parameters?.['name'] !== undefined &&
        !node.type.startsWith('text/') &&
        !node.type.startsWith('multipart/'));

    if (isAttachment) {
      const filename =
        node.dispositionParameters?.['filename'] ??
        node.parameters?.['name'] ??
        `attachment_${node.part}`;
      parts.push({
        partId: node.part,
        filename,
        contentType: node.type,
        size: node.size ?? 0,
      });
    }
  }

  private parseQuery(query: string): Record<string, unknown> {
    // Support simple key:value pairs — e.g. "from:alice subject:hello"
    const parts = query.trim().split(/\s+/);
    const criteria: Record<string, string[]> = {};

    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) {
        (criteria['text'] ??= []).push(part);
      } else {
        const key = part.slice(0, colonIdx).toLowerCase();
        const val = part.slice(colonIdx + 1);
        (criteria[key] ??= []).push(val);
      }
    }

    // imapflow search criteria object
    const result: Record<string, unknown> = {};
    if (criteria['from']?.[0]) result['from'] = criteria['from'][0];
    if (criteria['to']?.[0]) result['to'] = criteria['to'][0];
    if (criteria['subject']?.[0]) result['subject'] = criteria['subject'][0];
    if (criteria['text']?.[0]) result['body'] = criteria['text'][0];
    if (criteria['since']?.[0]) result['since'] = new Date(criteria['since'][0]);
    if (criteria['before']?.[0]) result['before'] = new Date(criteria['before'][0]);

    return Object.keys(result).length > 0 ? result : { all: true };
  }

  private toFetchedEmail(msg: FetchMessageObject): FetchedEmail {
    const env = msg.envelope;
    const from = env?.from?.[0]
      ? `${env.from[0].name ?? ''} <${env.from[0].address ?? ''}>`.trim()
      : '';
    const to = env?.to?.map((a) => a.address ?? '').join(', ') ?? '';
    const rawText = msg.bodyParts?.get('TEXT');
    const snippet = rawText
      ? Buffer.from(rawText).toString('utf8').slice(0, 200).replace(/\s+/g, ' ').trim()
      : '';

    return {
      uid: msg.uid ?? 0,
      subject: env?.subject ?? '(no subject)',
      from,
      to,
      date: env?.date?.toISOString() ?? '',
      snippet,
    };
  }
}
