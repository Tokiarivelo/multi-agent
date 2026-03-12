/**
 * Returns true if the given string is a valid absolute server-side path.
 *
 * Valid:
 *   /home/user/workspace
 *   /Users/alice/projects/my-app
 *   C:\Users\alice\workspace
 *   C:/Users/alice/workspace
 *
 * Invalid:
 *   ./relative          – relative (starts with ./)
 *   ../up               – traversal
 *   relative/path       – no leading slash or drive letter
 *   .                   – current dir shorthand
 *   ..                  – parent dir
 *   (empty string)
 */
export function isValidAbsolutePath(path: string): boolean {
  if (!path || !path.trim()) return false;
  const p = path.trim();

  // Reject . / .. / ./ / ../
  if (p === '.' || p === '..') return false;
  if (p.startsWith('./') || p.startsWith('../')) return false;
  if (p.startsWith('.\\') || p.startsWith('..\\')) return false;

  // Unix absolute: starts with /
  if (p.startsWith('/')) return true;

  // Windows absolute: C:\ or C:/
  if (/^[A-Za-z]:[/\\]/.test(p)) return true;

  return false;
}

/** Human-readable validation message for form feedback.  */
export function nativePathValidationError(path: string): string | null {
  if (!path || !path.trim()) {
    return 'Path cannot be empty.';
  }
  const p = path.trim();
  if (
    p === '.' ||
    p === '..' ||
    p.startsWith('./') ||
    p.startsWith('../') ||
    p.startsWith('.\\') ||
    p.startsWith('..\\')
  ) {
    return 'Path must be absolute (e.g. /home/user/workspace). Relative paths like ./ or ../ are not allowed.';
  }
  if (!isValidAbsolutePath(p)) {
    return 'Path must be an absolute path (start with / on Unix, or C:\\ on Windows).';
  }
  return null;
}
