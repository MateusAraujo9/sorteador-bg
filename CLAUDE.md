# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sorteador de Boardgames — a Portuguese-language web app for registering board games and randomly drawing one to play. Express backend in a small layered structure, a modular vanilla-JS frontend (no framework/bundler), SQLite (via Node's built-in `node:sqlite`) as the datastore. Cookie-based session auth scopes every board game to its owning user. No build step, no tests.

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
- `src/app.js` — Express app factory (`createApp()`): wires middleware (`cors`, `express.json`, cookie parsing, static `public/`) and mounts `src/routes`.
- `src/routes/auth.routes.js` — mounted at `/api/auth`. `register`/`login`/`logout` are public; `GET`/`PATCH /me` require `requireAuth`.
- `src/routes/boardgames.routes.js` — mounted at `/api/boardgames`. The whole router runs behind `requireAuth` (`router.use(requireAuth)`) — every boardgame endpoint requires a logged-in user.
- `src/controllers/auth.controller.js` — register/login/logout/me/updateProfile. Never returns `passwordHash` to the client (`toPublicUser`).
- `src/controllers/boardgames.controller.js` — request/response handling and input validation; always scopes reads/writes to `req.user.id`.
- `src/middleware/requireAuth.js` — reads the `sid` cookie, resolves it to a session then a user via the repositories below, and sets `req.user`; responds `401` otherwise.
- `src/middleware/cookies.js` — minimal hand-rolled `Cookie` header parser (no `cookie-parser` dependency) populating `req.cookies`.
- `src/utils/password.js` — password hashing with Node's built-in `crypto.scrypt` (salt + hash, `timingSafeEqual` compare) — no `bcrypt` dependency.
- `src/data/db.js` — the single shared `node:sqlite` `DatabaseSync` connection (`data/boardgames.db`). Every repository requires this instead of opening its own connection.
- `src/data/usersRepository.js` — `users` table (id, name, email UNIQUE, passwordHash, createdAt).
- `src/data/sessionsRepository.js` — `sessions` table (token, userId, createdAt, expiresAt). Sessions last 30 days (`SESSION_TTL_MS`); `findValid` lazily deletes expired rows.
- `src/data/boardgamesRepository.js` — `boardgames` table, now with a `userId` column. On startup it checks `PRAGMA table_info` and runs `ALTER TABLE ... ADD COLUMN userId` if missing, so it self-migrates an older DB file in place. All reads/writes are scoped by `userId` (`readAllByUser`, `randomOneByUser`, `update(id, userId, fields)`, `remove(id, userId)`).
- `data/boardgames.db` — the SQLite datastore file. Requires Node 22.5+ (built and tested on Node 24).
- `data/boardgames.json.bak` — the old JSON datastore, kept only as a historical backup from before the SQLite migration; not read by the app.

When adding a boardgame endpoint: add a repository function if new data access is needed (accepting `userId`), a controller function that validates input and shapes the response, and a route that wires it up — in that order. New authenticated endpoints outside `/api/boardgames` should use the `requireAuth` middleware the same way `auth.routes.js` does for `/me`.

### Auth model

- Session tokens are random 32-byte hex strings, stored server-side in the `sessions` table and set client-side as an `httpOnly`, `sameSite: lax` cookie named `sid` (see `setSessionCookie` in `auth.controller.js`). `secure` is only set when `NODE_ENV=production`.
- There is no CSRF token — this is a deliberate, proportionate call for this app's scope: `cors()` runs without `credentials: true`, so a cross-origin fetch can't carry the cookie, and `sameSite: lax` blocks it from cross-site non-GET requests too. Don't loosen the CORS config to allow credentialed cross-origin requests without adding real CSRF protection at the same time.
- Existing boardgames created before this feature landed have `userId = NULL` (orphaned) — they won't appear for any user via `readAllByUser`. Nothing auto-assigns them; if you need to attach them to an account, do it with a one-off script/SQL against `data/boardgames.db`.

### Frontend (`public/`, no build step, native ES modules)

- `index.html` — markup only. Three top-level regions inside `.container`: the always-visible `.brand-header` (includes the `#userBadge` shown only when authenticated), `#authView` (login/signup, shown when logged out), and `#appView` (the tab nav + panels — Cadastrar, Coleção, Sortear, Perfil — shown when logged in). `main.js` toggles these three via the `hidden` attribute.
- `css/tokens.css` — design tokens (color, type, spacing, radius, shadow) as CSS custom properties. `styles.css` imports it via `@import`.
- `css/styles.css` — all component/layout styles, built on the tokens.
- `js/api.js` — thin `fetch` wrapper; the only module that talks to the network. `api.auth.*` covers `me`/`register`/`login`/`logout`/`updateProfile`; errors thrown from `request()` carry `.status` so callers can special-case `401`.
- `js/render.js` — pure DOM-templating functions (game list, stats, empty state, result ticket). Escapes all user-provided strings via `escapeHtml`.
- `js/dice.js` — the dice-roll animation (decorative; the drawn game comes from the API, not from the die face).
- `js/icons.js` — inline SVG icon strings, reused by `render.js` and inlined directly in `index.html` for the header mark.
- `js/spine.js` — deterministic category → color-index hash used for the game-card spine color.
- `js/toast.js` — toast notifications.
- `js/main.js` — orchestration only: view switching (`showAuthView`/`showAppView`), tab switching, event wiring, calling `api`, passing results to `render`. `handleAuthError(err)` is the shared 401 handler — call it in every `catch` for an authenticated request so an expired session bounces the user back to `#authView` instead of failing silently. The "Cadastrar" tab doubles as the edit form: `editingGameId` (module-level state) tracks whether `registerForm` is in create or edit mode; `enterEditMode(game)`/`exitEditMode()` toggle the panel title, submit button label, and the "Cancelar edição" link, and `handleRegisterSubmit` branches between `api.create`/`api.update` based on it. Switching to any other tab implicitly cancels an in-progress edit. Keep business logic out of this file — put it in `render`/`api`/a new module instead.

### API surface

**Auth** (`/api/auth`)
- `POST /register` — `{ name, email, password }` (password min 6 chars). Creates the user, starts a session, sets the `sid` cookie.
- `POST /login` — `{ email, password }`. Generic `401` on any mismatch (doesn't reveal which field was wrong).
- `POST /logout` — clears the session (DB row + cookie).
- `GET /me` — current user (requires auth).
- `PATCH /me` — `{ name, email, currentPassword?, newPassword? }` (requires auth). `newPassword` requires a correct `currentPassword`.

**Boardgames** (`/api/boardgames`, all require auth)
- `GET /` — list the current user's games
- `POST /` — add a game (`name` required; `minPlayers`, `maxPlayers`, `duration`, `category`, `imageUrl`, `minAge` optional). Server assigns `id` (`Date.now().toString()`), `userId` (from the session), and `createdAt`.
- `PUT /:id` — update a game's fields (same body shape as `POST`; only if it belongs to the current user, `404` otherwise). `id`, `userId`, `createdAt` are immutable.
- `DELETE /:id` — remove a game (only if it belongs to the current user)
- `GET /random` — return one random game owned by the current user (404 if they have none)

### Data model

**User**: `id` (UUID), `name`, `email` (unique, lowercased), `passwordHash` (`scrypt salt:hash`, never sent to the client), `createdAt`.

**Boardgame**: `id, userId, name, minPlayers, maxPlayers, duration, category, imageUrl, minAge, createdAt` — all optional fields besides `name`, `userId` and `createdAt` are stored as `TEXT` columns, exactly as submitted (possibly `NULL`), not coerced to numbers server-side. `readAllByUser` orders by `createdAt ASC`; `randomOneByUser` uses `ORDER BY RANDOM() LIMIT 1`.

## Design system

Tabletop/felt-table visual identity, tokenized in `public/css/tokens.css`:

- **Color**: deep felt green (`--felt`) as the page surface, cream cardstock (`--card`) for panels/cards, `--ember` as the one primary-action accent. `--gold`, `--teal`, `--mustard`, `--plum` are secondary/spine accents — `spine.js` hashes a game's category to one of them (`spine-0`…`spine-4`) rather than assigning colors by hand.
- **Type**: `--font-display` (Fraunces) for headings/titles, `--font-body` (Inter) for UI copy, `--font-mono` (IBM Plex Mono) for stats/numbers — keep that role split when adding UI.
- **Signature element**: the "Sortear" tab draws a game via a flip-style die animation (`dice.js`) that resolves into a perforated raffle-ticket card (`.ticket` in `styles.css`) — this only appears once, on the felt background (not nested inside a cream `.panel`), so its punched-hole notches (`.ticket__perf::before/::after`, colored `var(--felt)`) blend correctly. If you rewrap `#drawStage` inside a `.panel`, update the notch color to match or the illusion breaks.
- **Auth screen**: reuses `.panel` (cream card) with an `.auth-toggle` pill switcher between the login and signup `.auth-form`s — same visual language as the tab system, not a separate style.

### Conventions to preserve

- Keep the layered backend structure (routes → controllers → repository) and the modular frontend (`public/css/*`, `public/js/*`) — don't collapse back into single-file `server.js`/`index.html`, this structure exists specifically to support future features.
- Data access goes through the repositories in `src/data/` only; controllers never touch `node:sqlite` directly. If you deploy to a platform with an ephemeral/read-only filesystem (e.g. Vercel, Netlify Functions), `data/boardgames.db` will not persist — swap the repositories for a hosted DB (e.g. Turso, which is SQLite-wire-compatible) rather than adding filesystem workarounds.
- Every new authenticated route must scope its data access by `req.user.id`, mirroring `boardgames.controller.js` — never trust a client-supplied user id.
- User-facing strings and UI copy are in Portuguese (pt-BR), written in an active, direct voice (e.g. toast/error copy says what happened and what to do, not a generic "erro ao..."); match that when adding new UI text or API error messages.
- No bundler/build step by design — frontend JS relies on native ES module `import`/`export` served as static files. If you add a module, reference it with an explicit relative path (and `.js` extension) from its importer.
