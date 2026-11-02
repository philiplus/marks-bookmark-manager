import { useRef, useState } from 'react';
import { AlertTriangle, FileText, Info, Upload, X } from 'lucide-react';
import { api } from '../api';
import type { ImportMode, ImportResult } from '../types';
import { errorMessage, formatBytes } from '../utils';
import { Modal } from './Modal';

interface ImportModalProps {
  defaultMode: ImportMode;
  onClose: () => void;
  onImported: (result: ImportResult) => void;
}

const MAX_FILE_SIZE = 30 * 1024 * 1024;

export function ImportModal({ defaultMode, onClose, onImported }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>(defaultMode);
  const [name, setName] = useState('Imported bookmarks');
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(candidate: File | undefined) {
    if (!candidate) return;

    if (candidate.size > MAX_FILE_SIZE) {
      setError('That file is larger than 30 MB.');
      return;
    }
    if (!/\.html?$/i.test(candidate.name) && candidate.type !== 'text/html') {
      setError('Choose a Chrome bookmarks export (.html file).');
      return;
    }

    setError(null);
    setFile(candidate);
  }

  async function handleImport() {
    if (!file || busy) return;

    setBusy(true);
    setError(null);

    try {
      const html = await file.text();
      const result = await api.importBookmarks({
        html,
        mode,
        name: mode === 'merge' ? name.trim() || undefined : undefined,
      });
      onImported(result);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Import bookmarks"
      subtitle="Bring your Chrome bookmarks in without losing the folder structure."
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleImport}
            disabled={!file || busy}
          >
            {busy ? <span className="button-spinner" /> : <Upload size={15} />}
            {busy ? 'Importing…' : 'Import bookmarks'}
          </button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        onChange={(event) => {
          pickFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {file ? (
        <div className="file-chip">
          <span className="file-chip-icon">
            <FileText size={18} />
          </span>
          <span className="file-chip-text">
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)}</span>
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setFile(null)}
            aria-label="Choose a different file"
            disabled={busy}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`dropzone${dragOver ? ' drag-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            pickFile(event.dataTransfer.files?.[0]);
          }}
        >
          <span className="dropzone-icon">
            <Upload size={22} />
          </span>
          <span className="dropzone-title">Drop your bookmarks file here</span>
          <span className="dropzone-hint">or click to browse · HTML up to 30 MB</span>
        </button>
      )}

      <div className="field import-mode">
        <span className="field-label">How should it be imported?</span>

        <label className={`radio-card${mode === 'merge' ? ' selected' : ''}`}>
          <input
            type="radio"
            name="import-mode"
            checked={mode === 'merge'}
            onChange={() => setMode('merge')}
          />
          <span>
            <strong>Add as a new folder</strong>
            <small>Keep your current library and place the import in its own folder.</small>
          </span>
        </label>

        <label className={`radio-card${mode === 'replace' ? ' selected' : ''}`}>
          <input
            type="radio"
            name="import-mode"
            checked={mode === 'replace'}
            onChange={() => setMode('replace')}
          />
          <span>
            <strong>Replace everything</strong>
            <small>Delete the current library and use this file as the new one.</small>
          </span>
        </label>
      </div>

      {mode === 'merge' && (
        <div className="field">
          <label htmlFor="import-name">Folder name</label>
          <input
            id="import-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={500}
            placeholder="Imported bookmarks"
          />
        </div>
      )}

      {mode === 'replace' && (
        <div className="form-warning">
          <AlertTriangle size={16} />
          <span>All existing bookmarks and folders will be replaced.</span>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <p className="import-help">
        <Info size={14} />
        <span>
          In Chrome, open <strong>Bookmarks → Bookmark manager</strong>, then use the three-dot
          menu to <strong>Export bookmarks</strong>.
        </span>
      </p>
    </Modal>
  );
}
