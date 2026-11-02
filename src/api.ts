import type {
  BookmarkTreeNode,
  CreateNodeInput,
  Database,
  ImportInput,
  ImportResult,
  MoveNodeInput,
  UpdateNodeInput,
} from '../shared/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is it running?');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the generic message.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  getTree(): Promise<Database> {
    return request<Database>('/api/tree');
  },

  createNode(input: CreateNodeInput): Promise<BookmarkTreeNode> {
    return request<BookmarkTreeNode>('/api/nodes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateNode(id: string, input: UpdateNodeInput): Promise<BookmarkTreeNode> {
    return request<BookmarkTreeNode>(`/api/nodes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteNode(id: string): Promise<{ deleted: BookmarkTreeNode }> {
    return request<{ deleted: BookmarkTreeNode }>(`/api/nodes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  moveNode(id: string, input: MoveNodeInput): Promise<BookmarkTreeNode> {
    return request<BookmarkTreeNode>(`/api/nodes/${encodeURIComponent(id)}/move`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  importBookmarks(input: ImportInput): Promise<ImportResult> {
    return request<ImportResult>('/api/import', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
