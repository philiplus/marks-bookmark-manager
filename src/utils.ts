import type { BookmarkTreeNode, FolderNode } from '../shared/types';

export interface SearchHit {
  node: BookmarkTreeNode;
  path: FolderNode[];
}

export function findNode(root: FolderNode, id: string): BookmarkTreeNode | null {
  if (root.id === id) return root;

  const stack: FolderNode[] = [root];

  while (stack.length > 0) {
    const folder = stack.pop()!;
    for (const child of folder.children) {
      if (child.id === id) return child;
      if (child.type === 'folder') stack.push(child);
    }
  }

  return null;
}

export function findFolder(root: FolderNode, id: string): FolderNode | null {
  const node = findNode(root, id);
  return node?.type === 'folder' ? node : null;
}

export function findPath(root: FolderNode, id: string): FolderNode[] {
  const path: FolderNode[] = [];

  const walk = (folder: FolderNode): boolean => {
    path.push(folder);
    if (folder.id === id) return true;

    for (const child of folder.children) {
      if (child.type === 'folder' && walk(child)) return true;
    }

    path.pop();
    return false;
  };

  return walk(root) ? path : [];
}

export function containsNode(folder: FolderNode, id: string): boolean {
  if (folder.id === id) return true;
  return folder.children.some((child) => child.type === 'folder' && containsNode(child, id));
}

export function countNodes(node: FolderNode): { folders: number; bookmarks: number } {
  let folders = 0;
  let bookmarks = 0;

  const walk = (folder: FolderNode) => {
    for (const child of folder.children) {
      if (child.type === 'folder') {
        folders += 1;
        walk(child);
      } else {
        bookmarks += 1;
      }
    }
  };

  walk(node);
  return { folders, bookmarks };
}

export function countBookmarks(node: FolderNode): number {
  return countNodes(node).bookmarks;
}

export function searchTree(root: FolderNode, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const hits: SearchHit[] = [];
  const walk = (folder: FolderNode, path: FolderNode[]) => {
    for (const child of folder.children) {
      const matches =
        child.title.toLowerCase().includes(needle) ||
        (child.type === 'bookmark' && child.url.toLowerCase().includes(needle));
      if (matches) hits.push({ node: child, path });
      if (child.type === 'folder') walk(child, [...path, child]);
    }
  };

  walk(root, [root]);
  return hits.slice(0, 300);
}

export function pathLabel(path: FolderNode[]): string {
  const names = path.slice(1).map((folder) => folder.title);
  return names.length > 0 ? names.join(' / ') : 'All bookmarks';
}

export function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    const allowed = new Set(['http:', 'https:', 'mailto:', 'ftp:', 'file:']);
    return allowed.has(url.protocol) ? raw : null;
  } catch {
    return null;
  }
}

export function prettyUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    const path = decodeURIComponent(url.pathname).replace(/\/$/, '');
    const suffix = `${path}${url.search}`;
    return suffix ? `${host}${suffix}` : host;
  } catch {
    return raw;
  }
}

export function avatarLetter(node: BookmarkTreeNode): string {
  if (node.type === 'bookmark') {
    try {
      const host = new URL(node.url).hostname.replace(/^www\./, '');
      if (host) return host.charAt(0).toUpperCase();
    } catch {
      // Fall through to the title.
    }
  }
  return node.title.trim().charAt(0).toUpperCase() || '#';
}

export function avatarStyle(seed: string): { background: string } {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 68% 54%), hsl(${(hue + 42) % 360} 70% 43%))`,
  };
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
