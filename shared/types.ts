export type NodeType = 'folder' | 'bookmark';

export interface NodeBase {
  id: string;
  type: NodeType;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkNode extends NodeBase {
  type: 'bookmark';
  url: string;
  description?: string;
}

export interface FolderNode extends NodeBase {
  type: 'folder';
  children: BookmarkTreeNode[];
}

export type BookmarkTreeNode = FolderNode | BookmarkNode;

export interface Database {
  version: 1;
  updatedAt: string;
  root: FolderNode;
}

export interface CreateNodeInput {
  type: NodeType;
  parentId: string;
  title: string;
  url?: string;
}

export interface UpdateNodeInput {
  title?: string;
  url?: string;
}

export interface MoveNodeInput {
  parentId: string;
  index?: number;
}

export type ImportMode = 'replace' | 'merge';

export interface ImportInput {
  html: string;
  mode: ImportMode;
  name?: string;
}

export interface ImportStats {
  folders: number;
  bookmarks: number;
}

export interface ImportResult {
  stats: ImportStats;
  folderId?: string;
}

export interface ApiErrorBody {
  error: string;
}
