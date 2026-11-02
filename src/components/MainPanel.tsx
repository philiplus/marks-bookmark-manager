import { Fragment } from 'react';
import {
  BookmarkPlus,
  ChevronRight,
  FolderPlus,
  Plus,
  SearchX,
  Upload,
  X,
} from 'lucide-react';
import type { Dnd } from '../dnd';
import type { BookmarkTreeNode, Database, FolderNode, NodeType, ToastTone } from '../types';
import { formatCount, pathLabel, prettyUrl, type SearchHit } from '../utils';
import { NodeRow } from './NodeRow';

interface MainPanelProps {
  db: Database;
  folder: FolderNode;
  path: FolderNode[];
  query: string;
  results: SearchHit[];
  dnd: Dnd;
  onSelectFolder: (id: string) => void;
  onCreate: (type: NodeType) => void;
  onEdit: (node: BookmarkTreeNode) => void;
  onDelete: (node: BookmarkTreeNode) => void;
  onImport: () => void;
  onClearSearch: () => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}

export function MainPanel({
  db,
  folder,
  path,
  query,
  results,
  dnd,
  onSelectFolder,
  onCreate,
  onEdit,
  onDelete,
  onImport,
  onClearSearch,
  onNotify,
}: MainPanelProps) {
  if (query.trim()) {
    return (
      <div className="content-inner">
        <header className="page-header">
          <div>
            <h1>Search results</h1>
            <p className="page-meta">
              {formatCount(results.length, 'result')} for “{query.trim()}”
            </p>
          </div>
          <button type="button" className="btn" onClick={onClearSearch}>
            <X size={15} />
            Clear search
          </button>
        </header>

        {results.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <SearchX size={26} />
            </span>
            <h2>No matches found</h2>
            <p>Try a different title, folder name, or part of a URL.</p>
          </div>
        ) : (
          <div className="node-list search-results">
            {results.map(({ node, path: hitPath }) => {
              const label = pathLabel(hitPath);
              const subtitle =
                node.type === 'folder'
                  ? `${formatCount(node.children.length, 'item')} · ${label}`
                  : `${prettyUrl(node.url)} · ${label}`;

              return (
                <NodeRow
                  key={node.id}
                  node={node}
                  subtitle={subtitle}
                  dnd={dnd}
                  onOpenFolder={onSelectFolder}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onNotify={onNotify}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const bookmarks = folder.children.filter((child) => child.type === 'bookmark').length;
  const folders = folder.children.filter((child) => child.type === 'folder').length;
  const isRoot = folder.id === db.root.id;

  return (
    <div className="content-inner">
      <Breadcrumbs path={path} onSelect={onSelectFolder} dnd={dnd} />

      <header className="page-header">
        <div>
          <h1>{isRoot ? 'All bookmarks' : folder.title}</h1>
          <p className="page-meta">
            {folder.children.length === 0
              ? 'No bookmarks yet'
              : `${formatCount(bookmarks, 'bookmark')} · ${formatCount(folders, 'folder')}`}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn" onClick={() => onCreate('folder')}>
            <FolderPlus size={15} />
            New folder
          </button>
          <button type="button" className="btn primary" onClick={() => onCreate('bookmark')}>
            <Plus size={15} />
            New bookmark
          </button>
        </div>
      </header>

      {folder.children.length === 0 ? (
        <div
          className={`empty-drop${dnd.dropTargetId === folder.id ? ' is-drop-target' : ''}`}
          onDragOver={(event) => dnd.over(event, folder.id)}
          onDragLeave={() => dnd.leave(folder.id)}
          onDrop={(event) => dnd.drop(event, folder.id)}
        >
          <EmptyState isRoot={isRoot} onImport={onImport} onCreate={onCreate} />
        </div>
      ) : (
        <div
          className={[
            'node-list',
            dnd.draggingId ? 'is-droppable' : '',
            dnd.dropTargetId === folder.id ? 'is-drop-target' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={(event) => dnd.over(event, folder.id)}
          onDragLeave={() => dnd.leave(folder.id)}
          onDrop={(event) => dnd.drop(event, folder.id)}
        >
          {folder.children.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              dnd={dnd}
              onOpenFolder={onSelectFolder}
              onEdit={onEdit}
              onDelete={onDelete}
              onNotify={onNotify}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Breadcrumbs({
  path,
  onSelect,
  dnd,
}: {
  path: FolderNode[];
  onSelect: (id: string) => void;
  dnd: Dnd;
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {path.map((folder, index) => {
        const isLast = index === path.length - 1;
        return (
          <Fragment key={folder.id}>
            {index > 0 && <ChevronRight className="crumb-sep" size={13} aria-hidden="true" />}
            <button
              type="button"
              className={`crumb${isLast ? ' current' : ''}`}
              onClick={() => onSelect(folder.id)}
              aria-current={isLast ? 'page' : undefined}
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
              {index === 0 ? 'All bookmarks' : folder.title}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

function EmptyState({
  isRoot,
  onImport,
  onCreate,
}: {
  isRoot: boolean;
  onImport: () => void;
  onCreate: (type: NodeType) => void;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <BookmarkPlus size={26} />
      </span>
      <h2>{isRoot ? 'Your library is empty' : 'This folder is empty'}</h2>
      <p>
        {isRoot
          ? 'Import your Chrome bookmarks to keep the folder structure intact, or start a collection from scratch.'
          : 'Add a bookmark here, create a subfolder, or drag a bookmark onto this folder in the sidebar.'}
      </p>
      <div className="empty-actions">
        {isRoot && (
          <button type="button" className="btn primary" onClick={onImport}>
            <Upload size={15} />
            Import bookmarks
          </button>
        )}
        <button type="button" className={isRoot ? 'btn' : 'btn primary'} onClick={() => onCreate('bookmark')}>
          <Plus size={15} />
          New bookmark
        </button>
        <button type="button" className="btn" onClick={() => onCreate('folder')}>
          <FolderPlus size={15} />
          New folder
        </button>
      </div>
    </div>
  );
}
