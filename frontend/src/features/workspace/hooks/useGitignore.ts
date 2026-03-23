import { useState, useEffect, useCallback, useRef } from 'react';

interface ParsedPattern {
  regex: RegExp;
  negated: boolean;
  dirOnly: boolean;
}

function parseGitignoreContent(content: string): ParsedPattern[] {
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .flatMap((l) => {
      let line = l;
      let negated = false;
      let dirOnly = false;

      if (line.startsWith('!')) { negated = true; line = line.slice(1); }
      if (line.endsWith('/')) { dirOnly = true; line = line.slice(0, -1); }

      const hasSlash = line.includes('/');

      // Escape special regex chars, then convert glob syntax
      const regexBody = line
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\x00')      // preserve ** temporarily
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\x00/g, '.*');       // ** → match anything including /

      // Anchored patterns (contain /) must match from root; others match any segment
      const regexStr = hasSlash
        ? `^${regexBody}(/|$)`
        : `(^|/)${regexBody}(/|$)`;

      try {
        return [{ regex: new RegExp(regexStr), negated, dirOnly }];
      } catch {
        return [];
      }
    });
}

function matchesPatterns(path: string, isDir: boolean, patterns: ParsedPattern[]): boolean {
  let ignored = false;
  for (const { regex, negated, dirOnly } of patterns) {
    if (dirOnly && !isDir) continue;
    if (regex.test(path)) ignored = !negated;
  }
  return ignored;
}

/**
 * Reads .gitignore from the workspace root and re-checks every 1.5 s.
 * Triggers a re-render whenever the file is saved (lastModified changes).
 */
export function useGitignore(rootHandle: FileSystemDirectoryHandle | undefined) {
  const [patterns, setPatterns] = useState<ParsedPattern[]>([]);
  const lastModifiedRef = useRef<number>(0);

  useEffect(() => {
    if (!rootHandle) return;

    const readGitignore = async () => {
      try {
        const fileHandle = await rootHandle.getFileHandle('.gitignore');
        const file = await fileHandle.getFile();
        if (file.lastModified === lastModifiedRef.current) return; // no change
        lastModifiedRef.current = file.lastModified;
        setPatterns(parseGitignoreContent(await file.text()));
      } catch {
        // .gitignore absent or unreadable — clear if we had patterns
        setPatterns((prev) => (prev.length > 0 ? [] : prev));
      }
    };

    readGitignore();
    const id = setInterval(readGitignore, 1500);
    return () => clearInterval(id);
  }, [rootHandle]);

  const isIgnoredByGitignore = useCallback(
    (path: string, isDir: boolean) => matchesPatterns(path, isDir, patterns),
    [patterns],
  );

  return { isIgnoredByGitignore };
}
