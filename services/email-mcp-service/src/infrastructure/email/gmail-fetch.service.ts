import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow, FetchMessageObject } from 'imapflow';

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

@Injectable()
export class GmailFetchService {
  private readonly logger = new Logger(GmailFetchService.name);

  private readonly defaultImap: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };

  constructor(private readonly config: ConfigService) {
    this.defaultImap = {
      host: this.config.get<string>('imap.host', 'imap.gmail.com'),
      port: this.config.get<number>('imap.port', 993),
      user: this.config.get<string>('imap.user', ''),
      pass: this.config.get<string>('imap.pass', ''),
    };
  }

  async fetchEmails(params: FetchEmailsParams = {}): Promise<FetchedEmail[]> {
    const host = params.imapHost ?? this.defaultImap.host;
    const port = params.imapPort ?? this.defaultImap.port;
    const user = params.imapUser ?? this.defaultImap.user;
    const pass = params.imapPass ?? this.defaultImap.pass;
    const mailbox = params.mailbox ?? 'INBOX';
    const limit = params.limit ?? 20;

    this.logger.log(
      `Fetching emails — mailbox: ${mailbox}, limit: ${limit}, host: ${host}:${port}, user: "${user}"`,
    );

    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass },
      logger: false,
    });

    await client.connect();

    const results: FetchedEmail[] = [];

    try {
      const lock = await client.getMailboxLock(mailbox);
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
    const host = params.imapHost ?? this.defaultImap.host;
    const port = params.imapPort ?? this.defaultImap.port;
    const user = params.imapUser ?? this.defaultImap.user;
    const pass = params.imapPass ?? this.defaultImap.pass;
    const mailbox = params.mailbox ?? 'INBOX';

    this.logger.log(
      `Manipulating emails — mailbox: ${mailbox}, action: ${params.action}, uids: ${params.uids.join(',')}`,
    );

    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass },
      logger: false,
    });

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
