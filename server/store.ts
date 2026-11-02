import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  BookmarkNode,
  BookmarkTreeNode,
  CreateNodeInput,
  Database,
  FolderNode,
  ImportInput,
  ImportResult,
  MoveNodeInput,
  UpdateNodeInput,
} from '../shared/types';
import { HttpError } from './errors';
import { countParsedTree, parseBookmarksHtml, type ParsedNode } from './parser';

export interface FoundEntry {
  node: BookmarkTreeNode;
  parent: FolderNode;
  index: number;
}

export class Store {
  private data: Database | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  get filePath(): string {
    return this.file;
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });

    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      assertDatabase(parsed);
      this.data = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(
          `Could not load the database at ${this.file}. Fix or remove the file and try again. ${(error as Error).message}`,
        );
      }

      const fresh = createEmptyDatabase();
      await this.persist(fresh);
      this.data = fresh;
    }
  }

  get tree(): Database {
    return structuredClone(this.requireData());
  }

  createNode(input: CreateNodeInput): Promise<BookmarkTreeNode> {
    return this.mutate((db) => {
      const parent = findFolder(db.root, input.parentId);
      if (!parent) throw new HttpError(404, 'Parent folder not found');

      const now = new Date().toISOString();

      if (input.type === 'folder') {
        const folder: FolderNode = {
          id: randomUUID(),
          type: 'folder',
          title: normalizeTitle(input.title, 'Untitled folder', true),
          children: [],
          createdAt: now,
          updatedAt: now,
        };
        parent.children.push(folder);
        parent.updatedAt = now;
        return folder;
      }

      const url = normalizeUrl(input.url);
      const bookmark: BookmarkNode = {
        id: randomUUID(),
        type: 'bookmark',
        title: normalizeTitle(input.title, hostnameOf(url) ?? 'Untitled bookmark', false),
        url,
        createdAt: now,
        updatedAt: now,
      };
      parent.children.push(bookmark);
      parent.updatedAt = now;
      return bookmark;
    });
  }

  updateNode(id: string, patch: UpdateNodeInput): Promise<BookmarkTreeNode> {
    return this.mutate((db) => {
      const entry = findEntry(db.root, id);
      if (!entry) throw new HttpError(404, 'Bookmark or folder not found');

      const now = new Date().toISOString();

      if (patch.title !== undefined) {
        entry.node.title = normalizeTitle(patch.title, entry.node.title, true);
      }

      if (patch.url !== undefined) {
        if (entry.node.type !== 'bookmark') {
          throw new HttpError(400, 'Folders do not have a URL');
        }
        entry.node.url = normalizeUrl(patch.url);
      }

      entry.node.updatedAt = now;
      entry.parent.updatedAt = now;
      return entry.node;
    });
  }

  deleteNode(id: string): Promise<BookmarkTreeNode> {
    return this.mutate((db) => {
      if (id === db.root.id) throw new HttpError(400, 'The root folder cannot be deleted');

      const entry = findEntry(db.root, id);
      if (!entry) throw new HttpError(404, 'Bookmark or folder not found');

      entry.parent.children.splice(entry.index, 1);
      entry.parent.updatedAt = new Date().toISOString();
      return entry.node;
    });
  }

  moveNode(id: string, input: MoveNodeInput): Promise<BookmarkTreeNode> {
    return this.mutate((db) => {
      if (id === db.root.id) throw new HttpError(400, 'The root folder cannot be moved');

      const entry = findEntry(db.root, id);
      if (!entry) throw new HttpError(404, 'Bookmark or folder not found');

      const target = findFolder(db.root, input.parentId);
      if (!target) throw new HttpError(404, 'Destination folder not found');
      if (target.id === entry.node.id) {
        throw new HttpError(400, 'A folder cannot be moved into itself');
      }
      if (entry.node.type === 'folder' && containsNode(entry.node, target.id)) {
        throw new HttpError(400, 'A folder cannot be moved into one of its own subfolders');
      }

      const sameParent = entry.parent.id === target.id;
      const originalIndex = entry.index;

      entry.parent.children.splice(entry.index, 1);

      let index = input.index;
      if (index === undefined) {
        index = target.children.length;
      } else {
        if (sameParent && index > originalIndex) index -= 1;
        index = Math.max(0, Math.min(index, target.children.length));
      }

      target.children.splice(index, 0, entry.node);
      const now = new Date().toISOString();
      entry.parent.updatedAt = now;
      target.updatedAt = now;

      return entry.node;
    });
  }

  importBookmarks(input: ImportInput): Promise<ImportResult> {
    const parsed = parseBookmarksHtml(input.html);
    const stats = countParsedTree(parsed);

    return this.mutate((db) => {
      const now = new Date().toISOString();
      const imported = parsed.children.map((child) => materialize(child, now));

      if (input.mode === 'replace') {
        db.root.children = imported;
        db.root.updatedAt = now;
        return { stats };
      }

      const date = now.slice(0, 10);
      const folder: FolderNode = {
        id: randomUUID(),
        type: 'folder',
        title: normalizeTitle(input.name, `Imported bookmarks — ${date}`, false),
        children: imported,
        createdAt: now,
        updatedAt: now,
      };

      db.root.children.push(folder);
      db.root.updatedAt = now;
      return { stats, folderId: folder.id };
    });
  }

  private mutate<T>(fn: (db: Database) => T): Promise<T> {
    const task = this.queue.then(async () => {
      const draft = structuredClone(this.requireData());
      const result = fn(draft);
      draft.updatedAt = new Date().toISOString();
      await this.persist(draft);
      this.data = draft;
      return result;
    });

    this.queue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  private async persist(db: Database): Promise<void> {
    const temp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
    await fs.rename(temp, this.file);
  }

  private requireData(): Database {
    if (!this.data) throw new Error('Store has not been initialized');
    return this.data;
  }
}

export function createEmptyDatabase(): Database {
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    root: {
      id: randomUUID(),
      type: 'folder',
      title: 'Bookmarks',
      children: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function findNode(root: FolderNode, id: string): BookmarkTreeNode | null {
  if (root.id === id) return root;
  return findEntry(root, id)?.node ?? null;
}

export function findFolder(root: FolderNode, id: string): FolderNode | null {
  const node = findNode(root, id);
  return node?.type === 'folder' ? node : null;
}

export function findEntry(root: FolderNode, id: string): FoundEntry | null {
  const stack: FolderNode[] = [root];

  while (stack.length > 0) {
    const folder = stack.pop()!;
    for (let index = 0; index < folder.children.length; index += 1) {
      const child = folder.children[index];
      if (child.id === id) return { node: child, parent: folder, index };
      if (child.type === 'folder') stack.push(child);
    }
  }

  return null;
}

export function containsNode(folder: FolderNode, id: string): boolean {
  if (folder.id === id) return true;
  return folder.children.some(
    (child) => child.type === 'folder' && containsNode(child, id),
  );
}

function materialize(node: ParsedNode, now: string): BookmarkTreeNode {
  if (node.type === 'folder') {
    return {
      id: randomUUID(),
      type: 'folder',
      title: node.title,
      children: node.children.map((child) => materialize(child, now)),
      createdAt: node.createdAt ?? now,
      updatedAt: now,
    };
  }

  const bookmark: BookmarkNode = {
    id: randomUUID(),
    type: 'bookmark',
    title: node.title,
    url: node.url,
    createdAt: node.createdAt ?? now,
    updatedAt: now,
  };
  if (node.description) bookmark.description = node.description;
  return bookmark;
}

function normalizeTitle(raw: unknown, fallback: string, required: boolean): string {
  const title = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!title && required) throw new HttpError(400, 'Title is required');
  return (title || fallback).slice(0, 500);
}

function normalizeUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new HttpError(400, 'URL is required');
  }

  let candidate = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new HttpError(400, 'Enter a valid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Only http and https URLs are supported');
  }

  return parsed.toString();
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
}

function assertDatabase(value: unknown): asserts value is Database {
  if (!value || typeof value !== 'object') {
    throw new Error('The database file is not a JSON object.');
  }

  const db = value as Database;
  if (db.version !== 1) throw new Error('Unsupported database version.');
  if (!db.root || db.root.type !== 'folder') throw new Error('Database root folder is missing.');
  validateNode(db.root);
}

function validateNode(node: BookmarkTreeNode): void {
  if (!node || typeof node !== 'object') throw new Error('Invalid node in database.');
  if (typeof node.id !== 'string' || typeof node.title !== 'string') {
    throw new Error('A node in the database is missing its id or title.');
  }

  if (node.type === 'folder') {
    if (!Array.isArray(node.children)) throw new Error('A folder in the database has no children array.');
    node.children.forEach(validateNode);
    return;
  }

  if (node.type !== 'bookmark' || typeof node.url !== 'string') {
    throw new Error('A bookmark in the database is invalid.');
  }
}
