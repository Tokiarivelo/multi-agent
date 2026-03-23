import ignore, { Ignore } from 'ignore';

/**
 * Creates an ignore instance from a .gitignore content string.
 * @param content The raw content of a .gitignore file.
 * @returns An Ignore instance that can be used to filter paths.
 */
export function createIgnoreFilter(content: string): Ignore {
  const ig = ignore();
  // Filter out empty lines and comments
  const rules = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  
  return ig.add(rules);
}

/**
 * Checks if a path should be ignored given an Ignore instance.
 * @param ig The Ignore instance.
 * @param path The path to check (relative to the root where .gitignore resides).
 * @returns True if the path is ignored.
 */
export function isPathIgnored(ig: Ignore, path: string): boolean {
  // strip leading slash if present for 'ignore' package consistency
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return ig.ignores(normalizedPath);
}
