# Contributing to Marks

Thanks for taking the time to improve Marks. This guide covers the local setup, the
standards we follow, and how to get a change merged.

## Code of conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please
report unacceptable behaviour to <filipemiguelcosta@outlook.com>.

## Getting started

Marks requires **Node.js 22.12 or newer** and npm.

```bash
git clone https://github.com/philiplus/marks-bookmark-manager.git
cd marks-bookmark-manager
npm install
npm run dev
```

The web app is served at <http://localhost:5173> and the API at
<http://localhost:3001>. Vite proxies `/api` to the API during development.

To check your work before opening a pull request:

```bash
npm run typecheck   # client and server TypeScript
npm test            # parser and store tests (node:test)
npm run build       # production frontend build
```

All three commands run in CI and must pass.

## Project layout

| Path             | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `server/`        | Express API, JSON store, Chrome import/export              |
| `shared/`        | Types shared by the client and server                      |
| `src/`           | React client (components, styles, API client)              |
| `samples/`       | Sample Chrome bookmark export for manual testing           |
| `docs/`          | API documentation and screenshots                          |

Keep shared shapes in `shared/types.ts` rather than redefining them in the client or
server. The JSON store is the single source of truth; every mutation must go through
`Store` so writes stay serialized and atomic.

## Making changes

1. Fork the repository and create a branch from `main`.
2. Make the smallest change that solves the problem. Follow the existing code style:
   TypeScript strict mode, single quotes, trailing commas, 2-space indentation, and
   named exports for components.
3. Add or update tests for behaviour changes. Parser changes belong in
   `server/parser.test.ts`; store changes belong in `server/store.test.ts`.
4. Update the README or `docs/API.md` when you change user-facing behaviour or the API.
5. Run the checks above and commit with a clear message.

### Commit messages

Use the imperative mood and a short subject line (72 characters or fewer), optionally
with a conventional prefix:

```
feat: add folder drag-and-drop reordering
fix: keep empty folders on Chrome import
docs: document the move endpoint
chore: bump vite
```

### Pull requests

- Describe **what** changed and **why**, and link any related issue.
- Include screenshots for UI changes.
- Keep pull requests focused; split unrelated changes.
- Be responsive to review feedback. Maintainers may squash commits on merge.

## Reporting bugs and requesting features

Use the [issue templates](.github/ISSUE_TEMPLATE). For security issues, do **not** open
a public issue — follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
