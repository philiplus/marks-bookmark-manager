# Marks REST API

Marks exposes a small JSON API over the bookmark tree. In development the API listens on
`http://localhost:3001` and Vite proxies `/api` from the web app; in production the same
Express process serves both the API and the built frontend on `PORT` (default `3001`).

```bash
npm run dev     # API on :3001, web on :5173
npm start       # API + built frontend on :3001
```

> **No authentication.** Marks is a single-user, local-first application. Any client that
> can reach the port has full read/write access to the library. Keep it bound to localhost
> or put an authenticating reverse proxy in front of it. See [SECURITY.md](../SECURITY.md).

## Conventions

- All request and response bodies are JSON (`content-type: application/json`), except the
  HTML export, which is `text/html`.
- JSON request bodies are limited to **30 MB**.
- API responses are sent with `Cache-Control: no-store`.
- Successful mutations return the affected node (or a result object) directly — there is
  no envelope.
- Errors use `{ "error": "message" }` with a non-2xx status code.
- IDs are server-generated UUIDs. Timestamps are ISO 8601 strings in UTC.

## Data model

The library is a single tree whose root is a folder. The root is addressable like any
other folder but cannot be moved or deleted.

```ts
type NodeType = 'folder' | 'bookmark';

interface NodeBase {
  id: string;
  type: NodeType;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

interface BookmarkNode extends NodeBase {
  type: 'bookmark';
  url: string;
  description?: string; // preserved from Chrome imports
}

interface FolderNode extends NodeBase {
  type: 'folder';
  children: BookmarkTreeNode[];
}

type BookmarkTreeNode = FolderNode | BookmarkNode;

interface Database {
  version: 1;
  updatedAt: string;
  root: FolderNode;
}
```

`GET /api/tree` returns the `Database` object. Everything else operates on nodes inside
`root`.

## Endpoints

| Method   | Endpoint               | Success | Description                              |
| -------- | ---------------------- | ------- | ---------------------------------------- |
| `GET`    | `/api/health`          | `200`   | Liveness check                           |
| `GET`    | `/api/tree`            | `200`   | Full database tree                       |
| `POST`   | `/api/nodes`           | `201`   | Create a folder or bookmark              |
| `PATCH`  | `/api/nodes/:id`       | `200`   | Rename a node or change a bookmark URL   |
| `DELETE` | `/api/nodes/:id`       | `200`   | Delete a node (folders recursively)      |
| `POST`   | `/api/nodes/:id/move`  | `200`   | Move a node into a folder                |
| `POST`   | `/api/import`          | `201`   | Import a Chrome/Netscape bookmarks file  |
| `GET`    | `/api/export/json`     | `200`   | Download a JSON backup                   |
| `GET`    | `/api/export/html`     | `200`   | Download a Chrome-compatible HTML export |

Any other `/api/*` route returns `404 { "error": "API route not found" }`.

---

### `GET /api/health`

```json
{ "ok": true }
```

Useful for container health checks and readiness probes. It does not touch the database
beyond the server having started successfully.

---

### `GET /api/tree`

Returns the entire database as a `Database` object. Read-only; safe to call frequently.

```bash
curl http://localhost:3001/api/tree
```

```json
{
  "version": 1,
  "updatedAt": "2026-11-02T10:00:00.000Z",
  "root": {
    "id": "0f3e…",
    "type": "folder",
    "title": "Bookmarks",
    "createdAt": "2026-11-02T09:00:00.000Z",
    "updatedAt": "2026-11-02T10:00:00.000Z",
    "children": []
  }
}
```

---

### `POST /api/nodes`

Create a folder or bookmark inside an existing folder.

**Body**

| Field      | Type                     | Required | Notes                                              |
| ---------- | ------------------------ | -------- | -------------------------------------------------- |
| `type`     | `"folder" \| "bookmark"` | yes      |                                                    |
| `parentId` | string                   | yes      | ID of an existing folder (may be the root)         |
| `title`    | string                   | no       | Trimmed and whitespace-collapsed; max 500 chars     |
| `url`      | string                   | bookmarks| Required for bookmarks; ignored for folders         |

Behaviour:

- Folder titles default to `"Untitled folder"` when empty.
- Bookmark titles default to the URL hostname (without `www.`) when empty.
- Bookmarks require a URL. A scheme-less value such as `example.com` is upgraded to
  `https://`. Only `http:` and `https:` are accepted.
- Folders are appended to the end of the parent. Bookmarks have no `description` unless
  they came from an import.

**Response `201`** — the created `FolderNode` or `BookmarkNode`.

```bash
curl -X POST http://localhost:3001/api/nodes \
  -H 'content-type: application/json' \
  -d '{"type":"folder","parentId":"ROOT_ID","title":"Design"}'
```

```json
{
  "id": "8c9d…",
  "type": "folder",
  "title": "Design",
  "children": [],
  "createdAt": "2026-11-02T10:01:00.000Z",
  "updatedAt": "2026-11-02T10:01:00.000Z"
}
```

---

### `PATCH /api/nodes/:id`

Rename a folder or bookmark, and/or change a bookmark's URL. At least one field is
required.

**Body**

| Field   | Type   | Notes                                        |
| ------- | ------ | -------------------------------------------- |
| `title` | string | Empty or whitespace-only values are rejected |
| `url`   | string | Bookmarks only; `http`/`https` only          |

Sending `url` for a folder returns `400`. Unknown IDs return `404`.

**Response `200`** — the updated node. Its `updatedAt` and its parent's `updatedAt` are
refreshed.

```bash
curl -X PATCH http://localhost:3001/api/nodes/NODE_ID \
  -H 'content-type: application/json' \
  -d '{"title":"Product design"}'
```

---

### `DELETE /api/nodes/:id`

Delete a node. Deleting a folder deletes all of its descendants; there is no confirmation
or soft delete in the API (the web UI asks first).

**Response `200`**

```json
{ "deleted": { "id": "…", "type": "bookmark", "title": "…", "url": "…", "…": "…" } }
```

- The root folder cannot be deleted (`400`).
- Unknown IDs return `404`.

```bash
curl -X DELETE http://localhost:3001/api/nodes/NODE_ID
```

---

### `POST /api/nodes/:id/move`

Move a node to another folder, optionally at a specific position.

**Body**

| Field      | Type   | Required | Notes                                             |
| ---------- | ------ | -------- | ------------------------------------------------- |
| `parentId` | string | yes      | Destination folder ID                             |
| `index`    | number | no       | Zero-based target index; clamped to the new list  |

Behaviour:

- Without `index`, the node is appended to the destination.
- When moving within the same parent, `index` is interpreted **before** removal, matching
  what a drag-and-drop UI expects, and is adjusted for the removal.
- A folder cannot be moved into itself or one of its own descendants (`400`).
- The root cannot be moved (`400`).
- Invalid destinations return `404`.

**Response `200`** — the moved node.

```bash
curl -X POST http://localhost:3001/api/nodes/NODE_ID/move \
  -H 'content-type: application/json' \
  -d '{"parentId":"FOLDER_ID","index":0}'
```

---

### `POST /api/import`

Parse a browser bookmarks HTML export (Chrome's Netscape format) and add it to the
library.

**Body**

| Field  | Type                   | Required | Notes                                                   |
| ------ | ---------------------- | -------- | ------------------------------------------------------- |
| `html` | string                 | yes      | Raw file contents; non-empty                           |
| `mode` | `"replace" \| "merge"` | no       | Defaults to `"replace"`                                 |
| `name` | string                 | no       | Merge only: title of the wrapper folder                 |

Modes:

- `replace` — the root's children are replaced by the imported tree.
- `merge` — the imported tree is placed inside a new folder at the end of the root. The
  folder is named `name`, or `Imported bookmarks — YYYY-MM-DD` when omitted.

The parser preserves nested folders, entity-encoded titles/URLs, `ADD_DATE` timestamps
(as `createdAt`), `<DD>` descriptions, and empty folders. Imported URLs are stored as-is;
the UI only links safe schemes.

**Response `201`**

```json
{
  "stats": { "folders": 7, "bookmarks": 42 },
  "folderId": "d4f1…"
}
```

`folderId` is only present for `merge` and is the ID of the wrapper folder. Stats count
everything imported, not the resulting library size.

```bash
node --input-type=module -e '
  import fs from "node:fs";
  const html = fs.readFileSync("samples/chrome-bookmarks.html", "utf8");
  const res = await fetch("http://localhost:3001/api/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ html, mode: "merge", name: "Chrome import" }),
  });
  console.log(await res.json());
'
```

Requests over 30 MB return `413`.

---

### `GET /api/export/json`

Download the whole database as indented JSON, with a `Content-Disposition` filename of
`marks-bookmarks-YYYY-MM-DD.json`. This is the same shape as `GET /api/tree` and can be
used as a backup.

```bash
curl -OJ http://localhost:3001/api/export/json
```

---

### `GET /api/export/html`

Download a Chrome-compatible bookmarks file
(`marks-bookmarks-YYYY-MM-DD.html`) that can be imported into Chrome or any other browser
that understands the Netscape format. Titles, URLs, and descriptions are HTML-escaped;
`createdAt`/`updatedAt` become `ADD_DATE`/`LAST_MODIFIED`.

```bash
curl -OJ http://localhost:3001/api/export/html
```

---

## Errors

All errors have the form:

```json
{ "error": "Human-readable message" }
```

| Status | When                                                                 |
| ------ | -------------------------------------------------------------------- |
| `400`  | Invalid body, missing title/URL, unsupported URL scheme, root mutation, folder cycle |
| `404`  | Unknown node or folder ID, or unknown `/api` route                    |
| `413`  | Request body exceeds 30 MB                                           |
| `500`  | Unexpected server error; details are logged server-side only         |

Examples of specific messages: `"Parent folder not found"`,
`"A folder cannot be moved into one of its own subfolders"`,
`"Only http and https URLs are supported"`, `"The request body is not valid JSON."`.

## Client example

```ts
const base = 'http://localhost:3001';

const tree = await fetch(`${base}/api/tree`).then((r) => r.json());

const folder = await fetch(`${base}/api/nodes`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'folder', parentId: tree.root.id, title: 'Reading' }),
}).then((r) => r.json());

await fetch(`${base}/api/nodes`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    type: 'bookmark',
    parentId: folder.id,
    title: 'MDN',
    url: 'https://developer.mozilla.org',
  }),
});
```

The web client's typed wrapper lives in [`src/api.ts`](../src/api.ts); the server routes
are in [`server/index.ts`](../server/index.ts).

## Configuration

| Variable  | Default          | Description                    |
| --------- | ---------------- | ------------------------------ |
| `PORT`    | `3001`           | API / production server port   |
| `DB_PATH` | `./data/db.json` | Path to the JSON database file |

The store is designed for a **single server process**. Writes are serialized in-process
and persisted atomically with a temp file plus rename, but there is no cross-process
locking — do not point multiple instances at the same file.

## Versioning

The API is currently unversioned and ships with the app. The JSON `version` field in the
database is `1`. Breaking changes to the database shape will bump that field and include
a migration path in the release notes.
