import type { BookmarkTreeNode, Database } from '../shared/types';

export function toChromeHtml(db: Database): string {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];

  renderChildren(db.root.children, 1, lines);
  lines.push('</DL><p>');

  return `${lines.join('\n')}\n`;
}

function renderChildren(children: BookmarkTreeNode[], depth: number, lines: string[]): void {
  const indent = '    '.repeat(depth);

  for (const node of children) {
    if (node.type === 'folder') {
      lines.push(
        `${indent}<DT><H3 ADD_DATE="${unix(node.createdAt)}" LAST_MODIFIED="${unix(node.updatedAt)}">${escapeHtml(node.title)}</H3>`,
      );
      lines.push(`${indent}<DL><p>`);
      renderChildren(node.children, depth + 1, lines);
      lines.push(`${indent}</DL><p>`);
    } else {
      lines.push(
        `${indent}<DT><A HREF="${escapeHtml(node.url)}" ADD_DATE="${unix(node.createdAt)}">${escapeHtml(node.title)}</A>`,
      );
      if (node.description) {
        lines.push(`${indent}<DD>${escapeHtml(node.description)}`);
      }
    }
  }
}

function unix(iso: string): number {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? Math.floor(time / 1000) : Math.floor(Date.now() / 1000);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
