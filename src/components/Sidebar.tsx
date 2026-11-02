import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Folder,
  Library,
  Plus,
  X,
} from 'lucide-react';
import type { Dnd } from '../dnd';
import type { FolderNode } from '../types';
import { countNodes, formatCount } from '../utils';

interface SidebarProps {
  root: FolderNode;
  selectedId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateFolder: (parentId: string) => void;
  dnd: Dnd;
  open: boolean;
  onClose: () => void;
}

interface TreeItemProps {
  folder: FolderNode;
  depth: number;
  rootId: string;
  selectedId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  dnd: Dnd;
}

function TreeItem({
  folder,
  depth,
  rootId,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  dnd,
}: TreeItemProps) {
  const hasSubfolders = folder.children.some((child) => child.type === 'folder');
  const isExpanded = expanded.has(folder.id);
  const isDropTarget = dnd.dropTargetId === folder.id;
  const isRoot = folder.id === rootId;

  return (
    <>
      <div
        className={[
          'tree-row',
          selectedId === folder.id ? 'active' : '',
          isDropTarget ? 'is-drop-target' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(folder.id)}
        onDragOver={(event) => {
          event.stopPropagation();
          dnd.over(event, folder.id);
        }}
        onDragLeave={(event) => {
          event.stopPropagation();
          dnd.leave(folder.id);
        }}
        onDrop={(event) => {
          event.stopPropagation();
          dnd.drop(event, folder.id);
        }}
      >
        {hasSubfolders ? (
          <button
            type="button"
            className="tree-chevron"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(folder.id);
            }}
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="tree-chevron" />
        )}

        {isRoot ? (
          <Library className="tree-icon" size={15} />
        ) : (
          <Folder className="tree-icon" size={15} />
        )}

        <span className="tree-label" title={folder.title}>
          {isRoot ? 'All bookmarks' : folder.title}
        </span>
        {folder.children.length > 0 && (
          <span className="tree-count">{folder.children.length}</span>
        )}
      </div>

      {isExpanded &&
        folder.children.map((child) =>
          child.type === 'folder' ? (
            <TreeItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              rootId={rootId}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              dnd={dnd}
            />
          ) : null,
        )}
    </>
  );
}

export function Sidebar({
  root,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  onCreateFolder,
  dnd,
  open,
  onClose,
}: SidebarProps) {
  const stats = countNodes(root);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar${open ? ' is-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Bookmark size={18} fill="currentColor" />
          </span>
          <span className="brand-text">
            <span className="brand-name">Marks</span>
            <span className="brand-tagline">Bookmark manager</span>
          </span>
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={onClose}
            aria-label="Close folder sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-heading">
          <span>Library</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => onCreateFolder(selectedId)}
            title="New folder here"
            aria-label="Create a new folder here"
          >
            <Plus size={16} />
          </button>
        </div>

        <nav className="tree" aria-label="Bookmark folders">
          <TreeItem
            folder={root}
            depth={0}
            rootId={root.id}
            selectedId={selectedId}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            dnd={dnd}
          />
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-stat">
            <span>
              {formatCount(stats.bookmarks, 'bookmark')} · {formatCount(stats.folders, 'folder')}
            </span>
          </div>
          <div className="sidebar-note">Saved locally to data/db.json</div>
        </div>
      </aside>
    </>
  );
}
