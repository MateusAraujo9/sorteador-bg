# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sorteador de Boardgames — a Portuguese-language web app for registering board games and randomly drawing one to play. Express backend in a small layered structure, a modular vanilla-JS frontend (no framework/bundler), SQLite (via Node's built-in `node:sqlite`) as the datastore. No build step, no tests.

## Commands

```
npm install   # install dependencies (express, cors)
npm start     # run the server (node server.js), serves on http://localhost:3000
npm run dev   # identical to npm start — no watch/reload configured
```

There is no test suite, linter, or build process in this repo.

## Architecture

### Backend (layered, not a single file)

- `server.js` — entry point only: creates the app via `src/app.js` and calls `.listen()`.
- `src/app.js` — Express app factory (`createApp()`): wires middleware (`cors`, `express.json`, static `public/`) and mounts `src/routes`.
- `src/routes/boardgames.routes.js` — maps HTTP verbs/paths to controller functions. Mounted at `/api/boardgames`.
- `src/controllers/boardgames.controller.js` — request/response handling and input validation; calls the repository for data access.
- `src/data/boardgamesRepository.js` — the only module that touches the database. Uses Node's built-in `node:sqlite` (`DatabaseSync`) — no external dependency, no native build step. Creates the `boardgames` table on first run if missing. Swap this module if the datastore ever changes (e.g. to a hosted DB for a serverless/ephemeral-disk deployment).
- `data/boardgames.db` — the SQLite datastore file. Requires Node 22.5+ (built and tested on Node 24).
- `data/boardgames.json.bak` — the old JSON datastore, kept only as a historical backup after the SQLite migration; not read by the app.

When adding an endpoint: add a repository function if new data access is needed, a controller function that validates input and shapes the response, and a route that wires it up — in that order.

### Frontend (`public/`, no build step, native ES modules)

- `index.html` — markup only. Loads `css/styles.css` and `js/main.js` (`type="module"`).
- `css/tokens.css` — design tokens (color, type, spacing, radius, shadow) as CSS custom properties. `styles.css` imports it via `@import`.
- `css/styles.css` — all component/layout styles, built on the tokens.
- `js/api.js` — thin `fetch` wrapper for `/api/boardgames*`; the only module that talks to the network.
- `js/render.js` — pure DOM-templating functions (game list, stats, empty state, result ticket). Escapes all user-provided strings via `escapeHtml`.
- `js/dice.js` — the dice-roll animation (decorative; the drawn game comes from the API, not from the die face).
- `js/icons.js` — inline SVG icon strings, reused by `render.js` and inlined directly in `index.html` for the header mark.
- `js/spine.js` — deterministic category → color-index hash used for the game-card spine color.
- `js/toast.js` — toast notifications.
- `js/main.js` — orchestration only: tab switching, event wiring, calling `api`, passing results to `render`. Keep business logic out of this file — put it in `render`/`api`/a new module instead.

### API surface

- `GET /api/boardgames` — list all games
- `POST /api/boardgames` — add a game (`name` required; `minPlayers`, `maxPlayers`, `duration`, `category`, `imageUrl`, `minAge` optional). Server assigns `id` (`Date.now().toString()`) and `createdAt`.
- `DELETE /api/boardgames/:id` — remove a game by id
- `GET /api/boardgames/random` — return one random game (404 if the list is empty)

### Data model (per game object)

`id, name, minPlayers, maxPlayers, duration, category, imageUrl, minAge, createdAt` — all optional fields besides `name` and `createdAt` are stored as `TEXT` columns, exactly as submitted (possibly `NULL`), not coerced to numbers server-side. `readAll` orders by `createdAt ASC`; `randomOne` uses `ORDER BY RANDOM() LIMIT 1`.

## Design system

Tabletop/felt-table visual identity, tokenized in `public/css/tokens.css`:

- **Color**: deep felt green (`--felt`) as the page surface, cream cardstock (`--card`) for panels/cards, `--ember` as the one primary-action accent. `--gold`, `--teal`, `--mustard`, `--plum` are secondary/spine accents — `spine.js` hashes a game's category to one of them (`spine-0`…`spine-4`) rather than assigning colors by hand.
- **Type**: `--font-display` (Fraunces) for headings/titles, `--font-body` (Inter) for UI copy, `--font-mono` (IBM Plex Mono) for stats/numbers — keep that role split when adding UI.
- **Signature element**: the "Sortear" tab draws a game via a flip-style die animation (`dice.js`) that resolves into a perforated raffle-ticket card (`.ticket` in `styles.css`) — this only appears once, on the felt background (not nested inside a cream `.panel`), so its punched-hole notches (`.ticket__perf::before/::after`, colored `var(--felt)`) blend correctly. If you rewrap `#drawStage` inside a `.panel`, update the notch color to match or the illusion breaks.

### Conventions to preserve

- Keep the layered backend structure (routes → controllers → repository) and the modular frontend (`public/css/*`, `public/js/*`) — don't collapse back into single-file `server.js`/`index.html`, this structure exists specifically to support future features.
- Data access goes through `boardgamesRepository.js` only; controllers never touch `node:sqlite` directly. If you deploy to a platform with an ephemeral/read-only filesystem (e.g. Vercel, Netlify Functions), `data/boardgames.db` will not persist — swap the repository for a hosted DB (e.g. Turso, which is SQLite-wire-compatible) rather than adding filesystem workarounds.
- User-facing strings and UI copy are in Portuguese (pt-BR), written in an active, direct voice (e.g. toast/error copy says what happened and what to do, not a generic "erro ao..."); match that when adding new UI text or API error messages.
- No bundler/build step by design — frontend JS relies on native ES module `import`/`export` served as static files. If you add a module, reference it with an explicit relative path (and `.js` extension) from its importer.
