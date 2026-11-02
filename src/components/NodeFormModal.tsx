import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { BookmarkTreeNode, NodeType } from '../types';
import { errorMessage } from '../utils';
import { Modal } from './Modal';

interface NodeFormModalProps {
  mode: 'create' | 'edit';
  nodeType: NodeType;
  parentId: string;
  parentName?: string;
  node?: BookmarkTreeNode;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function NodeFormModal({
  mode,
  nodeType,
  parentId,
  parentName,
  node,
  onClose,
  onSaved,
}: NodeFormModalProps) {
  const [title, setTitle] = useState(node?.title ?? '');
  const [url, setUrl] = useState(node?.type === 'bookmark' ? node.url : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isFolder = nodeType === 'folder';
  const heading =
    mode === 'create'
      ? isFolder
        ? 'New folder'
        : 'New bookmark'
      : isFolder
        ? 'Rename folder'
        : 'Edit bookmark';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setError(null);
    setBusy(true);

    try {
      if (mode === 'create') {
        await api.createNode({
          type: nodeType,
          parentId,
          title: title.trim(),
          url: isFolder ? undefined : url.trim(),
        });
        onSaved(isFolder ? 'Folder created' : 'Bookmark added');
      } else if (node) {
        await api.updateNode(
          node.id,
          isFolder ? { title: title.trim() } : { title: title.trim(), url: url.trim() },
        );
        onSaved('Changes saved');
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={heading}
      subtitle={
        mode === 'create' && parentName
          ? `Inside “${parentName}”`
          : isFolder
            ? 'Folders keep your bookmarks organized.'
            : 'Update the title or destination of this bookmark.'
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="node-form" className="btn primary" disabled={busy}>
            {busy && <span className="button-spinner" />}
            {mode === 'create' ? 'Create' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="node-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="node-title">{isFolder ? 'Folder name' : 'Title'}</label>
          <input
            id="node-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={isFolder ? 'e.g. Design inspiration' : 'e.g. Hacker News'}
            maxLength={500}
            autoFocus
            required
          />
        </div>

        {!isFolder && (
          <div className="field">
            <label htmlFor="node-url">URL</label>
            <input
              id="node-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <span className="field-hint">
              If you leave off <code>https://</code>, it is added for you.
            </span>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
      </form>
    </Modal>
  );
}
