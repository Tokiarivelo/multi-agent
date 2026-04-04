#!/usr/bin/env node
/**
 * Env File Guard (PreToolUse: Write)
 * Warns when writing to real .env files (not .env.example / .env.test).
 * Blocks if the content contains known secret patterns.
 */

const SAFE_ENV_SUFFIXES = ['.example', '.test', '.sample', '.template', '.ci'];

const SECRET_IN_ENV = [
  /AKIA[0-9A-Z]{16}/,
  /sk-[a-zA-Z0-9]{32,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /-----BEGIN\s+\w*\s*PRIVATE KEY-----/,
];

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  const input = JSON.parse(data);
  const filePath = input.tool_input?.file_path ?? '';
  const content  = input.tool_input?.content  ?? '';

  const isEnvFile = /\.env(\.|$)/.test(filePath.split('/').pop() ?? '');
  if (!isEnvFile) {
    process.stdout.write(data);
    return;
  }

  const isSafeVariant = SAFE_ENV_SUFFIXES.some(suffix =>
    filePath.endsWith(suffix)
  );

  // Check for real secrets in content
  const hasSecrets = SECRET_IN_ENV.some(p => p.test(content));

  if (hasSecrets) {
    process.stderr.write('[Security] BLOCKED — .env file contains hardcoded secret patterns.\n');
    process.stderr.write('  Replace literal secrets with placeholder values (e.g. your_secret_here).\n');
    process.exit(2);
  }

  if (!isSafeVariant) {
    process.stderr.write(`[Security] WARNING — Writing to a real .env file: ${filePath}\n`);
    process.stderr.write('  Ensure this file is listed in .gitignore and is never committed.\n');
  }

  process.stdout.write(data);
});
