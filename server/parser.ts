import { decode } from 'he';

export interface ParsedBookmark {
  type: 'bookmark';
  title: string;
  url: string;
  description?: string;
  createdAt?: string;
}

export interface ParsedFolder {
  type: 'folder';
  title: string;
  children: ParsedNode[];
  createdAt?: string;
}

export type ParsedNode = ParsedBookmark | ParsedFolder;

export interface ParsedStats {
  folders: number;
  bookmarks: number;
}

/**
 * Chrome's bookmark export is a Netscape bookmark file: a sequence of <DT>
 * entries inside nested <DL> lists. This parser walks the token stream rather
 * than building a DOM, because the format is not well-formed HTML (the <DT>
 * and <p> tags are left unclosed).
 */
export function parseBookmarksHtml(html: string): ParsedFolder {
  const root: ParsedFolder = {
    type: 'folder',
    title: 'Bookmarks',
    children: [],
  };

  // Each entry is a list of children. Folders push their own list when their
  // following <DL> is encountered.
  const stack: ParsedNode[][] = [root.children];
  let pendingFolder: ParsedFolder | null = null;
  let lastBookmark: ParsedBookmark | null = null;
  let sawRootList = false;

  const tokenRe =
    /<h3\b([^>]*)>([\s\S]*?)<\/h3\s*>|<a\b([^>]*)>([\s\S]*?)<\/a\s*>|<dl\b[^>]*>|<\/dl\s*>|<dd\b[^>]*>([\s\S]*?)(?=<\/dd\s*>|<dt\b|<dl\b|<\/dl\s*>|$)|<hr\b[^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(html)) !== null) {
    const [raw, h3Attrs, h3Body, aAttrs, aBody, ddBody] = match;

    if (/^<dl\b/i.test(raw)) {
      if (!sawRootList) {
        // The outermost <DL> is the root list itself.
        sawRootList = true;
      } else if (pendingFolder) {
        stack.push(pendingFolder.children);
        pendingFolder = null;
      } else {
        // Tolerate a stray list by re-using the current level.
        stack.push(stack[stack.length - 1]);
      }
      lastBookmark = null;
      continue;
    }

    if (/^<\/dl/i.test(raw)) {
      if (stack.length > 1) stack.pop();
      pendingFolder = null;
      lastBookmark = null;
      continue;
    }

    if (/^<h3\b/i.test(raw)) {
      const title = cleanText(h3Body) || 'Untitled folder';
      const folder: ParsedFolder = {
        type: 'folder',
        title,
        children: [],
        createdAt: parseDate(h3Attrs),
      };
      stack[stack.length - 1].push(folder);
      pendingFolder = folder;
      lastBookmark = null;
      continue;
    }

    if (/^<a\b/i.test(raw)) {
      const url = getAttribute(aAttrs, 'href')?.trim();
      if (!url) continue;
      const bookmark: ParsedBookmark = {
        type: 'bookmark',
        title: cleanText(aBody) || hostnameOf(url) || 'Untitled bookmark',
        url,
        createdAt: parseDate(aAttrs),
      };
      stack[stack.length - 1].push(bookmark);
      lastBookmark = bookmark;
      pendingFolder = null;
      continue;
    }

    if (/^<dd\b/i.test(raw) && ddBody) {
      if (lastBookmark && !lastBookmark.description) {
        const description = cleanText(ddBody).slice(0, 2000);
        if (description) lastBookmark.description = description;
      }
      continue;
    }

    // <HR> separators carry no data.
  }

  return root;
}

export function countParsedTree(root: ParsedFolder): ParsedStats {
  let folders = 0;
  let bookmarks = 0;

  const walk = (folder: ParsedFolder) => {
    for (const child of folder.children) {
      if (child.type === 'folder') {
        folders += 1;
        walk(child);
      } else {
        bookmarks += 1;
      }
    }
  };

  walk(root);
  return { folders, bookmarks };
}

function cleanText(value: string): string {
  return decode(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function getAttribute(attributes: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = attributes.match(re);
  if (!match) return undefined;
  const value = match[1] ?? match[2] ?? match[3] ?? '';
  return decode(value);
}

function parseDate(attributes: string): string | undefined {
  const raw = getAttribute(attributes, 'add_date') ?? getAttribute(attributes, 'last_modified');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
}
