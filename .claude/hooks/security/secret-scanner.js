#!/usr/bin/env node
/**
 * Secret Scanner Hook (PreToolUse: Edit | Write)
 * Blocks hardcoded secrets before they are written to disk.
 */

const SECRET_PATTERNS = [
  { name: 'AWS Access Key',       regex: /AKIA[0-9A-Z]{16}/,                    block: true  },
  { name: 'OpenAI / Anthropic key', regex: /sk-[a-zA-Z0-9]{32,}/,              block: true  },
  { name: 'GitHub personal token', regex: /ghp_[a-zA-Z0-9]{36}/,               block: true  },
  { name: 'Private key block',    regex: /-----BEGIN\s+\w*\s*PRIVATE KEY-----/, block: true  },
  { name: 'Hardcoded password',   regex: /password\s*[:=]\s*["'][^"']{6,}["']/i, block: false },
  { name: 'Hardcoded secret',     regex: /secret\s*[:=]\s*["'][^"']{6,}["']/i,   block: false },
  { name: 'Hardcoded API key',    regex: /api_?key\s*[:=]\s*["'][^"']{8,}["']/i, block: false },
  { name: 'Bearer token literal', regex: /Bearer\s+[a-zA-Z0-9\-._~+/]{20,}/,    block: false },
];

// Patterns that are clearly safe (env vars, placeholders, examples)
const SAFE_PATTERNS = [
  /process\.env\./,
  /\$\{[A-Z_]+\}/,
  /YOUR_|REPLACE_|<.*>|example|placeholder|xxx+/i,
  /\.env\.example/,
];

function isSafe(line) {
  return SAFE_PATTERNS.some(p => p.test(line));
}

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  const input = JSON.parse(data);
  const content =
    input.tool_input?.new_string ?? input.tool_input?.content ?? '';

  if (!content) {
    process.stdout.write(data);
    return;
  }

  const lines = content.split('\n');
  const findings = [];

  for (const pattern of SECRET_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (pattern.regex.test(line) && !isSafe(line)) {
        findings.push({ ...pattern, line: i + 1, sample: line.trim().slice(0, 80) });
      }
    }
  }

  if (findings.length === 0) {
    process.stdout.write(data);
    return;
  }

  const blocking = findings.filter(f => f.block);
  const warnings = findings.filter(f => !f.block);

  if (warnings.length > 0) {
    process.stderr.write('[Security] Potential hardcoded secrets detected:\n');
    for (const f of warnings) {
      process.stderr.write(`  [WARN] Line ${f.line}: ${f.name} — ${f.sample}\n`);
    }
    process.stderr.write('[Security] Use environment variables instead.\n');
  }

  if (blocking.length > 0) {
    process.stderr.write('[Security] BLOCKED — hardcoded secrets detected:\n');
    for (const f of blocking) {
      process.stderr.write(`  [BLOCK] Line ${f.line}: ${f.name} — ${f.sample}\n`);
    }
    process.stderr.write('[Security] Remove the secret and use process.env.SECRET_NAME instead.\n');
    process.exit(2);
  }

  process.stdout.write(data);
});
