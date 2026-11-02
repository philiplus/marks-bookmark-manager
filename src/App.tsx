import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { api } from './api';
import { ConfirmModal } from './components/ConfirmModal';
import { ImportModal } from './components/ImportModal';
import { MainPanel } from './components/MainPanel';
import { NodeFormModal } from './components/NodeFormModal';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/Toasts';
import { Topbar } from './components/Topbar';
import type { Dnd } from './dnd';
import type {
  BookmarkTreeNode,
  Database,
  ImportResult,
  NodeType,
  ToastMessage,
  ToastTone,
} from './types';
import {
  containsNode,
  errorMessage,
  findFolder,
  findNode,
  findPath,
  formatCount,
  searchTree,
} from './utils';

type ModalState =
  | {
      kind: 'node-form';
      mode: 'create' | 'edit';
      nodeType: NodeType;
      parentId: string;
      node?: BookmarkTreeNode;
    }
  | { kind: 'import' }
  | { kind: 'delete'; node: BookmarkTreeNode };

export default function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('root');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const toastCounter = useRef(0);

  const pushToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = toastCounter.current + 1;
    toastCounter.current = id;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const tree = await api.getTree();
      setDb(tree);
      setSelectedId((current) => (findFolder(tree.root, current) ? current : tree.root.id));
      setExpanded((current) => new Set([...current, tree.root.id]));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async (): Promise<Database | null> => {
    try {
      const tree = await api.getTree();
      setDb(tree);
      setSelectedId((current) => (findFolder(tree.root, current) ? current : tree.root.id));
      return tree;
    } catch (error) {
      pushToast(errorMessage(error), 'error');
      return null;
    }
  }, [pushToast]);

  const folder = useMemo(
    () => (db ? (findFolder(db.root, selectedId) ?? db.root) : null),
    [db, selectedId],
  );
  const path = useMemo(
    () => (db ? findPath(db.root, folder?.id ?? db.root.id) : []),
    [db, folder],
  );
  const results = useMemo(
    () => (db && query.trim() ? searchTree(db.root, query) : []),
    [db, query],
  );

  const selectFolder = useCallback(
    (id: string) => {
      setSelectedId(id);
      setQuery('');
      setSidebarOpen(false);
      setExpanded((current) => {
        if (!db) return current;
        const next = new Set(current);
        for (const ancestor of findPath(db.root, id)) next.add(ancestor.id);
        return next;
      });
    },
    [db],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const dnd = useMemo<Dnd>(
    () => ({
      draggingId,
      dropTargetId,
      start(event, node) {
        if (!db || node.id === db.root.id) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData('application/x-marks-node', node.id);
        event.dataTransfer.setData('text/plain', node.id);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingId(node.id);
      },
      end() {
        setDraggingId(null);
        setDropTargetId(null);
      },
      over(event, folderId) {
        if (!db || !draggingId || draggingId === folderId) return;
        const dragged = findNode(db.root, draggingId);
        if (dragged?.type === 'folder' && containsNode(dragged, folderId)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetId((current) => (current === folderId ? current : folderId));
      },
      leave(folderId) {
        setDropTargetId((current) => (current === folderId ? null : current));
      },
      drop(event, folderId) {
        event.preventDefault();
        const id =
          event.dataTransfer.getData('application/x-marks-node') ||
          event.dataTransfer.getData('text/plain');
        setDraggingId(null);
        setDropTargetId(null);
        if (!id || id === folderId) return;

        const target = db ? findFolder(db.root, folderId) : null;
        const targetName = target
          ? target.id === db?.root.id
            ? 'All bookmarks'
            : target.title
          : 'folder';

        void (async () => {
          try {
            await api.moveNode(id, { parentId: folderId });
            await refresh();
            pushToast(`Moved to “${targetName}”`);
          } catch (error) {
            pushToast(errorMessage(error), 'error');
          }
        })();
      },
    }),
    [db, draggingId, dropTargetId, refresh, pushToast],
  );

  const openCreate = (type: NodeType) => {
    if (!folder) return;
    setModal({ kind: 'node-form', mode: 'create', nodeType: type, parentId: folder.id });
  };

  const openCreateFolderIn = (parentId: string) => {
    setModal({ kind: 'node-form', mode: 'create', nodeType: 'folder', parentId });
  };

  const openEdit = (node: BookmarkTreeNode) => {
    if (!folder) return;
    setModal({
      kind: 'node-form',
      mode: 'edit',
      nodeType: node.type,
      parentId: folder.id,
      node,
    });
  };

  const openDelete = (node: BookmarkTreeNode) => {
    setModal({ kind: 'delete', node });
  };

  const handleSaved = async (message: string) => {
    setModal(null);
    await refresh();
    pushToast(message);
  };

  const handleDelete = async () => {
    if (!modal || modal.kind !== 'delete') return;

    const node = modal.node;
    setDeleting(true);

    try {
      await api.deleteNode(node.id);
      setModal(null);
      await refresh();
      pushToast(node.type === 'folder' ? 'Folder deleted' : 'Bookmark deleted');
    } catch (error) {
      pushToast(errorMessage(error), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleImported = async (result: ImportResult) => {
    setModal(null);
    const tree = await refresh();

    if (tree) {
      if (result.folderId) {
        const importedId = result.folderId;
        setSelectedId(importedId);
        setExpanded((current) => {
          const next = new Set(current);
          for (const ancestor of findPath(tree.root, importedId)) next.add(ancestor.id);
          return next;
        });
      } else {
        setSelectedId(tree.root.id);
        setExpanded((current) => new Set([...current, tree.root.id]));
      }
    }

    pushToast(
      `Imported ${formatCount(result.stats.bookmarks, 'bookmark')} in ${formatCount(result.stats.folders, 'folder')}`,
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (event.key === '/' && !isTyping && !modal) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === 'Escape') {
        if (modal) setModal(null);
        else if (sidebarOpen) setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal, sidebarOpen]);

  if (loadError) {
    return (
      <div className="full-state">
        <span className="full-state-icon error">
          <AlertCircle size={26} />
        </span>
        <h1>Couldn’t load your library</h1>
        <p>{loadError}</p>
        <button type="button" className="btn primary" onClick={() => void load()}>
          <RotateCcw size={15} />
          Try again
        </button>
      </div>
    );
  }

  if (!db || !folder) {
    return (
      <div className="loading">
        <span className="spinner" />
        Loading your library…
      </div>
    );
  }

  const parentName = folder.id === db.root.id ? 'All bookmarks' : folder.title;
  const deleteMessage =
    modal?.kind === 'delete'
      ? modal.node.type === 'folder'
        ? `“${modal.node.title}” and everything inside it will be permanently deleted.`
        : `“${modal.node.title}” will be permanently deleted.`
      : '';

  return (
    <div className="app">
      <Sidebar
        root={db.root}
        selectedId={folder.id}
        expanded={expanded}
        onToggle={toggleExpanded}
        onSelect={selectFolder}
        onCreateFolder={openCreateFolderIn}
        dnd={dnd}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="workspace">
        <Topbar
          query={query}
          onQueryChange={setQuery}
          onImport={() => setModal({ kind: 'import' })}
          onOpenSidebar={() => setSidebarOpen(true)}
          searchRef={searchRef}
        />
        <main className="content">
          <MainPanel
            db={db}
            folder={folder}
            path={path}
            query={query}
            results={results}
            dnd={dnd}
            onSelectFolder={selectFolder}
            onCreate={openCreate}
            onEdit={openEdit}
            onDelete={openDelete}
            onImport={() => setModal({ kind: 'import' })}
            onClearSearch={() => setQuery('')}
            onNotify={pushToast}
          />
        </main>
      </div>

      {modal?.kind === 'node-form' && (
        <NodeFormModal
          mode={modal.mode}
          nodeType={modal.nodeType}
          parentId={modal.parentId}
          parentName={modal.mode === 'create' ? parentName : undefined}
          node={modal.node}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.kind === 'import' && (
        <ImportModal
          defaultMode={db.root.children.length === 0 ? 'replace' : 'merge'}
          onClose={() => setModal(null)}
          onImported={handleImported}
        />
      )}

      {modal?.kind === 'delete' && (
        <ConfirmModal
          title={modal.node.type === 'folder' ? 'Delete folder?' : 'Delete bookmark?'}
          message={deleteMessage}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={() => void handleDelete()}
          onClose={() => setModal(null)}
        />
      )}

      <Toasts
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />
    </div>
  );
}
