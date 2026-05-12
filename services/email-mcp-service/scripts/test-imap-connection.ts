#!/usr/bin/env tsx
/**
 * Test script to diagnose IMAP connection issues
 * Usage: tsx scripts/test-imap-connection.ts
 */

import { ImapFlow } from 'imapflow';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env from root .env
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const IMAP_USER = process.env.IMAP_USER || '';
const IMAP_PASS = process.env.IMAP_PASS || '';
const IMAP_HOST = process.env.IMAP_HOST || 'imap.gmail.com';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);

console.log('📧 IMAP Connection Diagnostic Tool\n');
console.log('Configuration:');
console.log(`  Host: ${IMAP_HOST}:${IMAP_PORT}`);
console.log(`  User: ${IMAP_USER ? `${IMAP_USER.substring(0, 3)}***` : '❌ NOT SET'}`);
console.log(`  Pass: ${IMAP_PASS ? '✅ SET' : '❌ NOT SET'}\n`);

if (!IMAP_USER || !IMAP_PASS) {
  console.error('❌ Missing IMAP_USER or IMAP_PASS environment variables');
  console.error('   Set them in your .env file or environment\n');
  process.exit(1);
}

async function testConnection() {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_PORT === 993,
    auth: {
      user: IMAP_USER,
      pass: IMAP_PASS,
    },
    logger: {
      debug: (obj: any) => console.log('  [DEBUG]', obj.msg || obj),
      info: (obj: any) => console.log('  [INFO]', obj.msg || obj),
      warn: (obj: any) => console.warn('  [WARN]', obj.msg || obj),
      error: (obj: any) => console.error('  [ERROR]', obj.msg || obj),
    },
    connectionTimeout: 30_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });

  try {
    console.log('🔌 Attempting to connect...');
    const startTime = Date.now();

    await client.connect();
    const connTime = Date.now() - startTime;
    console.log(`✅ Connected successfully in ${connTime}ms\n`);

    console.log('📋 Listing mailboxes...');
    const mailboxes = await client.list();
    console.log(`✅ Found ${mailboxes.length} mailboxes:`);
    mailboxes.slice(0, 10).forEach((mb) => {
      console.log(`   - ${mb.path}${mb.specialUse ? ` (${mb.specialUse})` : ''}`);
    });
    if (mailboxes.length > 10) {
      console.log(`   ... and ${mailboxes.length - 10} more`);
    }
    console.log();

    console.log('📥 Accessing INBOX...');
    const lock = await client.getMailboxLock('INBOX');
    try {
      console.log(`✅ INBOX opened - ${client.mailbox?.exists || 0} messages\n`);

      if (client.mailbox && client.mailbox.exists > 0) {
        console.log('📧 Fetching latest email (as test)...');
        const messages = [];
        for await (const msg of client.fetch('1:1', { envelope: true, uid: true })) {
          messages.push(msg);
        }
        if (messages.length > 0) {
          const latest = messages[0];
          console.log(`✅ Successfully fetched email UID ${latest.uid}`);
          console.log(`   Subject: ${latest.envelope?.subject || 'N/A'}`);
          console.log(`   From: ${latest.envelope?.from?.[0]?.address || 'N/A'}\n`);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log('✅ All tests passed! IMAP connection is working correctly.\n');
  } catch (error: any) {
    console.error('\n❌ Connection failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.error('\n🔍 Troubleshooting tips:');
    if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
      console.error('  - Network/firewall may be blocking imap.gmail.com:993');
      console.error('  - Try: nc -zv imap.gmail.com 993');
      console.error("  - Check if you're behind a corporate proxy");
    }
    if (error.message.includes('authentication') || error.message.includes('Invalid credentials')) {
      console.error('  - Check IMAP_USER and IMAP_PASS are correct');
      console.error('  - For Gmail, use an App Password (not your regular password)');
      console.error('  - Enable "Less secure app access" or use OAuth2');
    }
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('  - DNS resolution failed. Check your internet connection');
      console.error('  - Try: ping imap.gmail.com');
    }
    console.error();
    process.exit(1);
  }
}

testConnection().catch(console.error);
