#!/usr/bin/env node
/**
 * Dangerous Bash Guard (PreToolUse: Bash)
 * Blocks or warns on destructive / dangerous shell commands.
 */

const BLOCK_PATTERNS = [
  { name: 'Force push to main/master',  regex: /git push.+(--force|-f)\s+(origin\s+)?(main|master)\b/ },
  { name: 'rm -rf system root',         regex: /rm\s+-[rf]+\s+(\/\s*$|\/\s+)/ },
  { name: 'Pipe to bash (curl/wget)',    regex: /(curl|wget)\s+.+\|\s*(sudo\s+)?bash/ },
  { name: 'chmod 777 recursive',         regex: /chmod\s+-R\s+777/ },
  { name: 'DROP DATABASE statement',     regex: /\bDROP\s+DATABASE\b/i },
  { name: 'Truncate all tables',         regex: /TRUNCATE\s+TABLE\s+\*/i },
  { name: 'Skip git hooks (--no-verify)', regex: /git\s+commit.+--no-verify/ },
];

const WARN_PATTERNS = [
  { name: 'Force push (non-main)',   regex: /git push.+(--force|-f)/ },
  { name: 'Hard reset',              regex: /git reset\s+--hard/ },
  { name: 'Remove node_modules',     regex: /rm\s+-[rf]+\s+node_modules/ },
  { name: 'git clean -f',            regex: /git clean\s+.*-f/ },
  { name: 'DROP TABLE',              regex: /\bDROP\s+TABLE\b/i },
  { name: 'Recursive delete',        regex: /rm\s+-[rf]+/ },
];

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  const input = JSON.parse(data);
  const command = input.tool_input?.command ?? '';

  if (!command) {
    process.stdout.write(data);
    return;
  }

  for (const p of BLOCK_PATTERNS) {
    if (p.regex.test(command)) {
      process.stderr.write(`[Security] BLOCKED — ${p.name}\n`);
      process.stderr.write(`  Command: ${command.trim().slice(0, 120)}\n`);
      process.exit(2);
    }
  }

  for (const p of WARN_PATTERNS) {
    if (p.regex.test(command)) {
      process.stderr.write(`[Security] WARNING — ${p.name}\n`);
      process.stderr.write(`  Command: ${command.trim().slice(0, 120)}\n`);
    }
  }

  process.stdout.write(data);
});
