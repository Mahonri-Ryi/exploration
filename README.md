# exploration

**Exploration Notes** — a small full-stack demo application used to validate the
Cloud Agent development environment end to end.

- **Backend:** Express + TypeScript, run with [`tsx`](https://tsx.is) (no build step in dev).
- **Frontend:** static HTML/CSS/JS served by Express.
- **Storage:** in-memory (not persisted — this is a demo).
- **Tests:** [Vitest](https://vitest.dev) + Supertest.

## Requirements

- Node.js >= 20 (Node 22 recommended)
- npm (bundled with Node)

## Getting started

```bash
npm ci        # install dependencies from the lockfile
npm run dev   # start the dev server on http://localhost:3000
```

Then open http://localhost:3000 and add a note.

## Scripts

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the dev server with hot reload (`tsx`). |
| `npm run build`     | Compile TypeScript to `dist/`.                |
| `npm start`         | Run the compiled server from `dist/`.         |
| `npm run typecheck` | Type-check without emitting.                  |
| `npm test`          | Run the Vitest test suite.                     |

## API

| Method | Path          | Description                     |
| ------ | ------------- | ------------------------------- |
| `GET`  | `/api/health` | Health probe (`{ status }`).    |
| `GET`  | `/api/notes`  | List all notes.                 |
| `POST` | `/api/notes`  | Create a note (`{ text }`).     |

## Cloud Agent environment

The Cloud Agent environment is defined in [`.cursor/environment.json`](.cursor/environment.json):

- `install` runs `npm ci` to restore dependencies from the lockfile.
- A `dev server` terminal runs `npm run dev`, exposing the app on port `3000`.
