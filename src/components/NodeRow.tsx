import {
  ExternalLink,
  Folder,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Dnd } from '../dnd';
import type { BookmarkTreeNode, ToastTone } from '../types';
import {
  avatarLetter,
  avatarStyle,
  countNodes,
  formatCount,
  prettyUrl,
  safeHref,
} from '../utils';
import { Dropdown, MenuItem, MenuSeparator } from './Dropdown';

interface NodeRowProps {
  node: BookmarkTreeNode;
  subtitle?: string;
  dnd: Dnd;
  onOpenFolder: (id: string) => void;
  onEdit: (node: BookmarkTreeNode) => void;
  onDelete: (node: BookmarkTreeNode) => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}

export function NodeRow({
  node,
  subtitle,
  dnd,
  onOpenFolder,
  onEdit,
  onDelete,
  onNotify,
}: NodeRowProps) {
  const defaultSubtitle =
    node.type === 'folder'
      ? (() => {
          const counts = countNodes(node);
          return (
            [
              counts.folders ? formatCount(counts.folders, 'folder') : '',
              counts.bookmarks ? formatCount(counts.bookmarks, 'bookmark') : '',
            ]
              .filter(Boolean)
              .join(' · ') || 'Empty folder'
          );
        })()
      : prettyUrl(node.url);

  const href = node.type === 'bookmark' ? safeHref(node.url) : null;
  const isDropTarget = node.type === 'folder' && dnd.dropTargetId === node.id;
  const isDragging = dnd.draggingId === node.id;

  async function copyLink() {
    if (node.type !== 'bookmark') return;
    try {
      await navigator.clipboard.writeText(node.url);
      onNotify('Link copied to clipboard');
    } catch {
      onNotify('Could not copy the link', 'error');
    }
  }

  const content = (
    <>
      <span
        className={`node-icon ${node.type}`}
        style={node.type === 'bookmark' ? avatarStyle(node.url) : undefined}
        aria-hidden="true"
      >
        {node.type === 'folder' ? <Folder size={18} /> : avatarLetter(node)}
      </span>
      <span className="node-text">
        <span className="node-title" title={node.title}>
          {node.title}
        </span>
        <span className="node-sub" title={subtitle ?? defaultSubtitle}>
          {subtitle ?? defaultSubtitle}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={[
        'node-row',
        `node-row-${node.type}`,
        isDragging ? 'is-dragging' : '',
        isDropTarget ? 'is-drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable
      onDragStart={(event) => dnd.start(event, node)}
      onDragEnd={dnd.end}
      onDragOver={
        node.type === 'folder'
          ? (event) => {
              event.stopPropagation();
              dnd.over(event, node.id);
            }
          : undefined
      }
      onDragLeave={
        node.type === 'folder'
          ? (event) => {
              event.stopPropagation();
              dnd.leave(node.id);
            }
          : undefined
      }
      onDrop={
        node.type === 'folder'
          ? (event) => {
              event.stopPropagation();
              dnd.drop(event, node.id);
            }
          : undefined
      }
    >
      {node.type === 'folder' ? (
        <button type="button" className="node-main" onClick={() => onOpenFolder(node.id)}>
          {content}
        </button>
      ) : href ? (
        <a
          className="node-main"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
        >
          {content}
        </a>
      ) : (
        <div className="node-main node-main-static" title="This URL cannot be opened from the app">
          {content}
        </div>
      )}

      <div className="node-end">
        <div className="node-actions">
          <Dropdown
            button={({ open, toggle }) => (
              <button
                type="button"
                className={`icon-button node-menu-button${open ? ' active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle();
                }}
                aria-label={`Actions for ${node.title}`}
              >
                <MoreHorizontal size={17} />
              </button>
            )}
          >
            {(close) => (
              <>
                {node.type === 'folder' ? (
                  <MenuItem
                    icon={<Folder size={15} />}
                    label="Open folder"
                    onClick={() => {
                      close();
                      onOpenFolder(node.id);
                    }}
                  />
                ) : (
                  <MenuItem
                    icon={<ExternalLink size={15} />}
                    label="Open in new tab"
                    onClick={() => {
                      close();
                      if (href) {
                        window.open(href, '_blank', 'noopener,noreferrer');
                      } else {
                        onNotify('This link uses an unsupported URL scheme', 'error');
                      }
                    }}
                  />
                )}
                <MenuItem
                  icon={<Pencil size={15} />}
                  label={node.type === 'folder' ? 'Rename folder' : 'Edit bookmark'}
                  onClick={() => {
                    close();
                    onEdit(node);
                  }}
                />
                {node.type === 'bookmark' && (
                  <MenuItem
                    icon={<Link2 size={15} />}
                    label="Copy link"
                    onClick={() => {
                      close();
                      void copyLink();
                    }}
                  />
                )}
                <MenuSeparator />
                <MenuItem
                  icon={<Trash2 size={15} />}
                  label="Delete"
                  danger
                  onClick={() => {
                    close();
                    onDelete(node);
                  }}
                />
              </>
            )}
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
