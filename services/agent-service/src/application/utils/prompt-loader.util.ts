import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves the `prompts/` directory, supporting both:
 *
 *  - **Production / compiled** (`dist/`): `__dirname` points to
 *    `dist/application/utils/`, so `../prompts/` → `dist/application/prompts/`
 *    (NestJS copies .md files there via nest-cli.json `assets`).
 *
 *  - **Development / ts-node**: `__dirname` still resolves to the compiled
 *    equivalent; when the file is not found there we fall back one more
 *    level and look inside `src/application/prompts/` relative to the
 *    project root.
 */
function resolvePromptPath(filename: string): string {
  // Primary: co-located with compiled output (dist/application/prompts/)
  const primary = path.resolve(__dirname, '..', 'prompts', filename);
  if (fs.existsSync(primary)) return primary;

  // Fallback: src/ tree (ts-node / swc watch without a prior build step)
  const srcFallback = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'src',
    'application',
    'prompts',
    filename,
  );
  if (fs.existsSync(srcFallback)) return srcFallback;

  // Last resort: walk up to find the src sibling of the current dist tree
  const distRoot = __dirname.includes(`${path.sep}dist${path.sep}`)
    ? __dirname.slice(0, __dirname.indexOf(`${path.sep}dist${path.sep}`))
    : null;

  if (distRoot) {
    const fromDist = path.resolve(distRoot, 'src', 'application', 'prompts', filename);
    if (fs.existsSync(fromDist)) return fromDist;
  }

  throw new Error(
    `[PromptLoader] Could not locate prompt file "${filename}". ` +
      `Checked:\n  ${primary}\n  ${srcFallback}`,
  );
}

/**
 * Reads a Markdown prompt file from the `prompts/` directory, interpolates
 * `{{variable}}` placeholders with the provided context map, and trims the result.
 *
 * @param filename  Filename relative to the `prompts/` directory (e.g. `"workspace-context.md"`).
 * @param variables Optional key/value map — every `{{key}}` in the file is replaced with its value.
 * @returns Processed prompt string ready to be appended to a system prompt.
 *
 * @example
 * loadPrompt('workspace-context.md', { workspacePath: '/home/user/project' })
 */
export function loadPrompt(
  filename: string,
  variables: Record<string, string> = {},
): string {
  const filePath = resolvePromptPath(filename);

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(
      `[PromptLoader] Failed to read prompt file at "${filePath}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // Replace every {{key}} placeholder with the corresponding value
  return Object.entries(variables)
    .reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), content)
    .trim();
}
