import type { DragEvent } from 'react';
import type { BookmarkTreeNode } from './types';

export interface Dnd {
  draggingId: string | null;
  dropTargetId: string | null;
  start: (event: DragEvent<HTMLElement>, node: BookmarkTreeNode) => void;
  end: () => void;
  over: (event: DragEvent<HTMLElement>, folderId: string) => void;
  leave: (folderId: string) => void;
  drop: (event: DragEvent<HTMLElement>, folderId: string) => void;
}
