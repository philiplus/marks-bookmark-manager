import { type RefObject } from 'react';
import {
  ChevronDown,
  Download,
  FileCode,
  FileJson,
  Menu,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Dropdown, MenuItem } from './Dropdown';

interface TopbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onImport: () => void;
  onOpenSidebar: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

export function Topbar({
  query,
  onQueryChange,
  onImport,
  onOpenSidebar,
  searchRef,
}: TopbarProps) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button mobile-menu"
        onClick={onOpenSidebar}
        aria-label="Open folders"
      >
        <Menu size={19} />
      </button>

      <div className="search">
        <Search className="search-icon" size={16} />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search bookmarks and folders…"
          aria-label="Search bookmarks and folders"
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </div>

      <div className="topbar-actions">
        <button type="button" className="btn" onClick={onImport}>
          <Upload size={15} />
          <span>Import</span>
        </button>

        <Dropdown
          button={({ open, toggle }) => (
            <button
              type="button"
              className={`btn${open ? ' active' : ''}`}
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <Download size={15} />
              <span>Export</span>
              <ChevronDown size={13} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<FileJson size={15} />}
                label="JSON backup"
                onClick={() => {
                  close();
                  window.location.href = '/api/export/json';
                }}
              />
              <MenuItem
                icon={<FileCode size={15} />}
                label="Chrome HTML"
                onClick={() => {
                  close();
                  window.location.href = '/api/export/html';
                }}
              />
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
