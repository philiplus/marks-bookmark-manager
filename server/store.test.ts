import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from './store';

async function withStore(run: (store: Store) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'marks-store-'));
  const store = new Store(path.join(directory, 'db.json'));

  try {
    await store.init();
    await run(store);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('creates folders and bookmarks in the root folder', async () => {
  await withStore(async (store) => {
    const rootId = store.tree.root.id;

    const folder = await store.createNode({
      type: 'folder',
      parentId: rootId,
      title: 'Top level',
    });
    const bookmark = await store.createNode({
      type: 'bookmark',
      parentId: rootId,
      title: 'Root bookmark',
      url: 'example.com',
    });

    assert.equal(folder.type, 'folder');
    assert.equal(bookmark.type, 'bookmark');
    if (bookmark.type === 'bookmark') {
      assert.equal(bookmark.url, 'https://example.com/');
    }

    const tree = store.tree;
    assert.equal(tree.root.children.length, 2);
    assert.deepEqual(
      tree.root.children.map((child) => child.title),
      ['Top level', 'Root bookmark'],
    );
  });
});

test('updates, moves, and deletes nodes', async () => {
  await withStore(async (store) => {
    const rootId = store.tree.root.id;
    const source = await store.createNode({ type: 'folder', parentId: rootId, title: 'Source' });
    const target = await store.createNode({ type: 'folder', parentId: rootId, title: 'Target' });
    const bookmark = await store.createNode({
      type: 'bookmark',
      parentId: source.id,
      title: 'Move me',
      url: 'https://example.com',
    });

    const updated = await store.updateNode(bookmark.id, {
      title: 'Moved me',
      url: 'https://example.org/path',
    });
    assert.equal(updated.title, 'Moved me');
    if (updated.type === 'bookmark') {
      assert.equal(updated.url, 'https://example.org/path');
    }

    await store.moveNode(bookmark.id, { parentId: target.id });
    const moved = store.tree.root.children.find((child) => child.id === target.id);
    assert.equal(moved?.type, 'folder');
    if (moved?.type === 'folder') {
      assert.equal(moved.children.length, 1);
      assert.equal(moved.children[0].id, bookmark.id);
    }

    await store.deleteNode(source.id);
    assert.equal(store.tree.root.children.length, 1);

    await assert.rejects(store.deleteNode(rootId), /root folder cannot be deleted/i);
  });
});

test('prevents moving a folder into itself or a descendant', async () => {
  await withStore(async (store) => {
    const rootId = store.tree.root.id;
    const parent = await store.createNode({ type: 'folder', parentId: rootId, title: 'Parent' });
    const child = await store.createNode({ type: 'folder', parentId: parent.id, title: 'Child' });

    await assert.rejects(
      store.moveNode(parent.id, { parentId: parent.id }),
      /cannot be moved into itself/i,
    );
    await assert.rejects(
      store.moveNode(parent.id, { parentId: child.id }),
      /own subfolders/i,
    );
  });
});

test('moves a nested bookmark back to the root', async () => {
  await withStore(async (store) => {
    const rootId = store.tree.root.id;
    const folder = await store.createNode({ type: 'folder', parentId: rootId, title: 'Folder' });
    const bookmark = await store.createNode({
      type: 'bookmark',
      parentId: folder.id,
      title: 'Bookmark',
      url: 'https://example.com',
    });

    await store.moveNode(bookmark.id, { parentId: rootId });

    const tree = store.tree;
    assert.equal(tree.root.children.length, 2);
    assert.equal(tree.root.children[1].id, bookmark.id);
  });
});

test('imports a Chrome export, preserves nesting, and persists it', async () => {
  await withStore(async (store) => {
    const html = `<DL><p>
      <DT><H3>Bookmarks bar</H3>
      <DL><p>
        <DT><A HREF="https://example.com">Example</A>
        <DT><H3>Nested</H3>
        <DL><p><DT><A HREF="https://nested.example">Nested bookmark</A></DL><p>
      </DL><p>
    </DL><p>`;

    const result = await store.importBookmarks({ html, mode: 'merge', name: 'Import' });
    assert.deepEqual(result.stats, { folders: 2, bookmarks: 2 });
    assert.ok(result.folderId);

    const tree = store.tree;
    assert.equal(tree.root.children.length, 1);
    const imported = tree.root.children[0];
    assert.equal(imported.type, 'folder');
    if (imported.type !== 'folder') return;
    assert.equal(imported.title, 'Import');
    assert.equal(imported.children.length, 1);
    assert.equal(imported.children[0].title, 'Bookmarks bar');

    const persisted = JSON.parse(await readFile(store.filePath, 'utf8')) as {
      root: { children: unknown[] };
    };
    assert.equal(persisted.root.children.length, 1);
  });
});

test('replace import swaps the whole tree', async () => {
  await withStore(async (store) => {
    const rootId = store.tree.root.id;
    await store.createNode({ type: 'bookmark', parentId: rootId, title: 'Old', url: 'https://old.example' });

    const html = '<DL><p><DT><H3>Fresh</H3><DL><p><DT><A HREF="https://new.example">New</A></DL><p></DL><p>';
    const result = await store.importBookmarks({ html, mode: 'replace' });
    assert.deepEqual(result.stats, { folders: 1, bookmarks: 1 });
    assert.equal(result.folderId, undefined);

    const tree = store.tree;
    assert.equal(tree.root.children.length, 1);
    assert.equal(tree.root.children[0].title, 'Fresh');
  });
});

test('serializes concurrent writes without losing data', async () => {
  await withStore(async (store) => {
    const rootId = store.tree.root.id;

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        store.createNode({
          type: 'bookmark',
          parentId: rootId,
          title: `Bookmark ${index}`,
          url: `https://example.com/${index}`,
        }),
      ),
    );

    assert.equal(store.tree.root.children.length, 10);
    const persisted = JSON.parse(await readFile(store.filePath, 'utf8')) as {
      root: { children: unknown[] };
    };
    assert.equal(persisted.root.children.length, 10);
  });
});
