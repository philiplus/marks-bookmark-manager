import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countParsedTree, parseBookmarksHtml, type ParsedFolder } from './parser';

const chromeExport = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="1700000100">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="1700000000">Example &amp; Co</A>
        <DD>A short description
        <DT><H3>Dev</H3>
        <DL><p>
            <DT><A HREF="https://github.com">GitHub</A>
            <DT><H3>Empty folder</H3>
        </DL><p>
        <DT><A HREF="javascript:alert(1)">Sneaky link</A>
    </DL><p>
    <DT><H3>Other bookmarks</H3>
    <DL><p>
        <DT><A HREF="https://news.ycombinator.com">Hacker News</A>
    </DL><p>
</DL><p>`;

function folderTitles(folder: ParsedFolder): string[] {
  return folder.children.filter((child) => child.type === 'folder').map((child) => child.title);
}

test('parses top-level folders and preserves nesting', () => {
  const root = parseBookmarksHtml(chromeExport);
  assert.deepEqual(folderTitles(root), ['Bookmarks bar', 'Other bookmarks']);

  const bar = root.children[0];
  assert.equal(bar.type, 'folder');
  if (bar.type !== 'folder') return;

  assert.equal(bar.createdAt, new Date(1_700_000_000 * 1000).toISOString());
  assert.deepEqual(folderTitles(bar), ['Dev']);

  const dev = bar.children[1];
  assert.equal(dev.type, 'folder');
  if (dev.type !== 'folder') return;
  assert.deepEqual(
    dev.children.map((child) => child.title),
    ['GitHub', 'Empty folder'],
  );
});

test('decodes entities and captures descriptions', () => {
  const root = parseBookmarksHtml(chromeExport);
  const bar = root.children[0];
  assert.equal(bar.type, 'folder');
  if (bar.type !== 'folder') return;

  const first = bar.children[0];
  assert.equal(first.type, 'bookmark');
  if (first.type !== 'bookmark') return;
  assert.equal(first.title, 'Example & Co');
  assert.equal(first.url, 'https://example.com/?a=1&b=2');
  assert.equal(first.description, 'A short description');
});

test('counts folders and bookmarks', () => {
  const root = parseBookmarksHtml(chromeExport);
  assert.deepEqual(countParsedTree(root), { folders: 4, bookmarks: 4 });
});

test('handles bookmarks at the root of the export', () => {
  const root = parseBookmarksHtml(
    '<DL><p><DT><A HREF="https://root.example">Root bookmark</A></DL><p>',
  );
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].title, 'Root bookmark');
});

test('tolerates malformed markup without throwing', () => {
  const root = parseBookmarksHtml('<DL><DT><H3>Broken<DT><A HREF="https://a.example">A');
  assert.equal(root.children.length, 0);
});

test('skips anchors without a URL', () => {
  const root = parseBookmarksHtml('<DL><DT><A>No href</A></DL>');
  assert.equal(root.children.length, 0);
});
