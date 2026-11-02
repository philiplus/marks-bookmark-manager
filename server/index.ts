import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  CreateNodeInput,
  ImportInput,
  MoveNodeInput,
  UpdateNodeInput,
} from '../shared/types';
import { HttpError } from './errors';
import { toChromeHtml } from './html';
import { Store } from './store';

const port = Number(process.env.PORT ?? 3001);
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'data/db.json');
const clientDir = path.resolve(process.cwd(), 'dist/client');

const store = new Store(dbPath);
await store.init();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '30mb' }));

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/tree', (_req, res) => {
  res.json(store.tree);
});

app.post('/api/nodes', async (req, res) => {
  const node = await store.createNode(parseCreateBody(req.body));
  res.status(201).json(node);
});

app.patch('/api/nodes/:id', async (req, res) => {
  const node = await store.updateNode(req.params.id, parseUpdateBody(req.body));
  res.json(node);
});

app.delete('/api/nodes/:id', async (req, res) => {
  const node = await store.deleteNode(req.params.id);
  res.json({ deleted: node });
});

app.post('/api/nodes/:id/move', async (req, res) => {
  const node = await store.moveNode(req.params.id, parseMoveBody(req.body));
  res.json(node);
});

app.post('/api/import', async (req, res) => {
  const result = await store.importBookmarks(parseImportBody(req.body));
  res.status(201).json(result);
});

app.get('/api/export/json', (_req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="marks-bookmarks-${date}.json"`);
  res.type('application/json').send(`${JSON.stringify(store.tree, null, 2)}\n`);
});

app.get('/api/export/html', (_req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="marks-bookmarks-${date}.html"`);
  res.type('text/html').send(toChromeHtml(store.tree));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

if (existsSync(path.join(clientDir, 'index.html'))) {
  app.use(express.static(clientDir));

  // Read the SPA shell once at startup instead of touching the filesystem on
  // every navigation request. The build output is immutable until a restart.
  const indexHtml = readFileSync(path.join(clientDir, 'index.html'), 'utf8');

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    res.type('html').send(indexHtml);
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    (error as { type?: string }).type === 'entity.too.large'
  ) {
    res.status(413).json({ error: 'That file is too large (30 MB maximum).' });
    return;
  }

  if (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: number }).status === 400
  ) {
    res.status(400).json({ error: 'The request body is not valid JSON.' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(port, () => {
  const shownPath = path.relative(process.cwd(), store.filePath) || store.filePath;
  console.log(`Marks API listening on http://localhost:${port}`);
  console.log(`Database: ${shownPath}`);
});

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function parseCreateBody(body: unknown): CreateNodeInput {
  const data = asRecord(body);

  if (data.type !== 'folder' && data.type !== 'bookmark') {
    throw new HttpError(400, "type must be either 'folder' or 'bookmark'");
  }
  if (typeof data.parentId !== 'string' || !data.parentId) {
    throw new HttpError(400, 'parentId is required');
  }

  return {
    type: data.type,
    parentId: data.parentId,
    title: typeof data.title === 'string' ? data.title : '',
    url: typeof data.url === 'string' ? data.url : undefined,
  };
}

function parseUpdateBody(body: unknown): UpdateNodeInput {
  const data = asRecord(body);
  const patch: UpdateNodeInput = {};

  if ('title' in data) {
    if (typeof data.title !== 'string') throw new HttpError(400, 'title must be a string');
    patch.title = data.title;
  }
  if ('url' in data) {
    if (typeof data.url !== 'string') throw new HttpError(400, 'url must be a string');
    patch.url = data.url;
  }
  if (patch.title === undefined && patch.url === undefined) {
    throw new HttpError(400, 'Provide a title or url to update');
  }

  return patch;
}

function parseMoveBody(body: unknown): MoveNodeInput {
  const data = asRecord(body);

  if (typeof data.parentId !== 'string' || !data.parentId) {
    throw new HttpError(400, 'parentId is required');
  }
  if (
    data.index !== undefined &&
    (typeof data.index !== 'number' || !Number.isInteger(data.index) || data.index < 0)
  ) {
    throw new HttpError(400, 'index must be a non-negative integer');
  }

  return {
    parentId: data.parentId,
    index: data.index as number | undefined,
  };
}

function parseImportBody(body: unknown): ImportInput {
  const data = asRecord(body);

  if (typeof data.html !== 'string' || !data.html.trim()) {
    throw new HttpError(400, 'The bookmark file is empty');
  }

  const mode = data.mode ?? 'replace';
  if (mode !== 'replace' && mode !== 'merge') {
    throw new HttpError(400, "mode must be either 'replace' or 'merge'");
  }
  if (data.name !== undefined && typeof data.name !== 'string') {
    throw new HttpError(400, 'name must be a string');
  }

  return {
    html: data.html,
    mode,
    name: data.name as string | undefined,
  };
}
