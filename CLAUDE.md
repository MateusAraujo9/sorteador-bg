# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sorteador de Boardgames — a Portuguese-language web app for registering board games and randomly drawing one to play. Express backend in a small layered structure, a modular vanilla-JS frontend (no framework/bundler), SQLite/libSQL (via `@libsql/client`) as the datastore — a local file with zero config, or Turso (hosted libSQL) in production. Cookie-based session auth scopes every board game to its owning user. No build step, no tests.

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
- `src/controllers/boardgameLinks.controller.js` — CRUD for a boardgame's documents (manual, expansions...). Every handler first calls `boardgamesRepository.findByIdForUser(gameId, req.user.id)` and `404`s if that fails, before touching `boardgameLinksRepository` — links are a nested resource, so ownership is always checked through the parent game, never by trusting `gameId` alone.
- `src/middleware/requireAuth.js` — reads the `sid` cookie, resolves it to a session then a user via the repositories below, and sets `req.user`; responds `401` otherwise.
- `src/middleware/cookies.js` — minimal hand-rolled `Cookie` header parser (no `cookie-parser` dependency) populating `req.cookies`.
- `src/middleware/rateLimit.js` — minimal hand-rolled fixed-window rate limiter (no `express-rate-limit` dependency), keyed by `${route}:${req.ip}` in an in-memory `Map` with a periodic sweep. Applied to `/api/auth/register` (5/hour) and `/api/auth/login` (10/15min) in `auth.routes.js`. Relies on `app.set('trust proxy', 1)` in `app.js` for `req.ip` to reflect the real client behind a reverse proxy — without it, every request behind the same proxy shares one bucket.
- `src/utils/password.js` — password hashing with Node's built-in `crypto.scrypt` (salt + hash, `timingSafeEqual` compare) — no `bcrypt` dependency.
- `src/utils/mailer.js` — `sendPasswordResetEmail(to, resetUrl)` via Brevo's transactional email **HTTP API** (`fetch`, no dependency), not SMTP — outbound SMTP ports (465/587) are commonly blocked on free-tier hosts (confirmed on Render: a Gmail-SMTP version of this hung indefinitely there, worked fine locally). Uses `BREVO_API_KEY`/`BREVO_SENDER_EMAIL` env vars; the call has a 15s `AbortSignal.timeout` so a Brevo outage fails loudly instead of hanging the request. The only email the app sends.
- `src/utils/asyncHandler.js` — wraps an async Express handler so a rejected promise reaches `next(err)` instead of crashing unhandled (Express 4 doesn't do this automatically). Every controller/middleware function that awaits a repository call is wrapped in this.
- `src/data/db.js` — the single shared `@libsql/client` connection, used by every repository. Picks its target from env vars: if `TURSO_DATABASE_URL` is set, it connects to that (Turso, with `TURSO_AUTH_TOKEN`); otherwise it falls back to a local file at `data/boardgames.db` (auto-created, zero config). **All repository calls are async** — `db.execute({ sql, args })` returns a promise resolving to `{ rows, rowsAffected, ... }`, not the synchronous `node:sqlite` shape used earlier in this project's history.
- `src/data/migrate.js` — `runMigrations()`, the single place schema is created/evolved (all three `CREATE TABLE IF NOT EXISTS` + the `boardgames.userId` and `boardgames.deletedAt` column self-migrations via `PRAGMA table_info`). Called once from `server.js` before `app.listen()` — repositories themselves no longer create tables at require-time.
- `src/data/usersRepository.js` — `users` table (id, name, email UNIQUE, passwordHash, createdAt).
- `src/data/sessionsRepository.js` — `sessions` table (token, userId, createdAt, expiresAt). Sessions last 30 days (`SESSION_TTL_MS`); `findValid` lazily deletes expired rows. `removeAllForUser(userId)` is used by password reset to log out every existing session once the password changes.
- `src/data/passwordResetsRepository.js` — `password_resets` table (token, userId, createdAt, expiresAt), same shape/pattern as sessions but with a 1-hour TTL (`RESET_TTL_MS`).
- `src/data/boardgamesRepository.js` — `boardgames` table, scoped by `userId` on every read/write (`readAllByUser`, `findByIdForUser`, `randomOneByUser`, `update(id, userId, fields)`, `remove(id, userId)`). `readAllByUser` and `randomOneByUser` both attach each game's `links` array (batched via `boardgameLinksRepository.listByBoardgameIds`, not one query per game). `remove` is a **soft delete**: it sets `deletedAt` to the current timestamp instead of deleting the row, and every read (`readAllByUser`, `findByIdForUser`, `update`, `randomOneByUser`) filters on `deletedAt IS NULL` by default, so a soft-deleted game and its ownership gate (`findByIdForUser`) disappear from the app immediately. `readAllByUser(userId, { includeDeleted })` is the one exception — passing `includeDeleted: true` drops that filter so soft-deleted games are returned too (used by the "Coleção" tab's "Incluir excluídos" filter, see `main.js` below). `boardgame_links` rows are deliberately left in place, neither soft- nor hard-deleted — they become unreachable once the parent game is gone (every link handler checks `findByIdForUser` first), so they're orphaned-but-inert rather than cascaded.
- `src/data/boardgameLinksRepository.js` — `boardgame_links` table (id, boardgameId, label, url, createdAt): a game's documents (rules PDF, expansions...). Deliberately a separate table rather than a column, since a game can have any number of them.
- `data/boardgames.db` — the local SQLite/libSQL datastore file, used only when `TURSO_DATABASE_URL` is unset. Not committed to git (see `.gitignore`) — it holds real account data once you register a user.
- `.env` (not committed) / `.env.example` (committed, empty template) — `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`. Loaded via Node's built-in `process.loadEnvFile()` in `server.js` (no `dotenv` dependency); silently skipped if no `.env` file exists, which is the normal case in local dev.

When adding a boardgame endpoint: add a repository function if new data access is needed (accepting `userId`, `async`, using `db.execute`), a controller function wrapped in `asyncHandler` that validates input and shapes the response, and a route that wires it up — in that order. New authenticated endpoints outside `/api/boardgames` should use the `requireAuth` middleware the same way `auth.routes.js` does for `/me`.

### Auth model

- Session tokens are random 32-byte hex strings, stored server-side in the `sessions` table and set client-side as an `httpOnly`, `sameSite: lax` cookie named `sid` (see `setSessionCookie` in `auth.controller.js`). `secure` is derived from `req.secure` (not `NODE_ENV`) — combined with `app.set('trust proxy', 1)` in `app.js`, this means the cookie is automatically marked `Secure` whenever the request actually arrived over HTTPS (directly or via a reverse proxy's `X-Forwarded-Proto`), and never marked `Secure` over plain HTTP (so local dev over `http://localhost` keeps working). Don't switch this back to an env-var check — it's a footgun if the var is never set in production.
- `/api/auth/register` and `/api/auth/login` are rate-limited (see `rateLimit.js` above) against brute-force and mass account creation.
- There is no CSRF token — this is a deliberate, proportionate call for this app's scope: `cors()` runs without `credentials: true`, so a cross-origin fetch can't carry the cookie, and `sameSite: lax` blocks it from cross-site non-GET requests too. Don't loosen the CORS config to allow credentialed cross-origin requests without adding real CSRF protection at the same time.
- Existing boardgames created before this feature landed have `userId = NULL` (orphaned) — they won't appear for any user via `readAllByUser`. Nothing auto-assigns them; if you need to attach them to an account, do it with a one-off script/SQL against `data/boardgames.db`.
- Password reset (`/api/auth/forgot-password`, `/api/auth/reset-password`) never reveals whether an email is registered — same `200` response either way; only sends the email (and creates the reset token) when the account actually exists. Resetting the password invalidates every existing session for that user (`sessionsRepository.removeAllForUser`), not just the one that requested the reset.

### Frontend (`public/`, no build step, native ES modules)

- `index.html` — markup only. Three top-level regions inside `.container`: the always-visible `.brand-header` (includes the `#userBadge` shown only when authenticated), `#authView` (login/signup/forgot-password, shown when logged out), and `#appView` (the tab nav + panels — Cadastrar, Coleção, Sortear, Perfil — shown when logged in). `main.js` toggles these three via the `hidden` attribute.
- `reset-password.html` + `js/reset-password.js` — standalone page for the "esqueci minha senha" email link (`?token=...`). Deliberately separate from `index.html`/`main.js` rather than folded into the auth-view state machine, since it's reached from outside the app (an email link) and has nothing to do with the logged-in/out flow.
- `css/tokens.css` — design tokens (color, type, spacing, radius, shadow) as CSS custom properties. `styles.css` imports it via `@import`.
- `css/styles.css` — all component/layout styles, built on the tokens. **Gotcha**: an element toggled via the native `hidden` property/attribute only actually hides if no author CSS rule sets `display` on that same selector (or a class it carries) — author-origin CSS always wins over the browser's default `[hidden] { display: none }` UA rule, regardless of specificity or source order. This bit `.user-badge` for real (`display: flex` kept the "Sair" button visible on the logged-out screen even with `hidden` set from JS); fixed with an explicit `.user-badge[hidden] { display: none }` override. Before adding `hidden`-attribute visibility toggling to a new element, check whether its class already sets `display` — if so, either add the same `[hidden]` override or (preferred, and what the rest of the app does) toggle a class like `.is-active` instead of the attribute.
- `js/api.js` — thin `fetch` wrapper; the only module that talks to the network. `api.auth.*` covers `me`/`register`/`login`/`logout`/`updateProfile`/`forgotPassword`/`resetPassword`; errors thrown from `request()` carry `.status` so callers can special-case `401`.
- `js/render.js` — pure DOM-templating functions (game list, stats, empty state, result ticket). Escapes all user-provided strings via `escapeHtml`.
- `js/dice.js` — the dice-roll animation (decorative; the drawn game comes from the API, not from the die face).
- `js/icons.js` — inline SVG icon strings, reused by `render.js` and inlined directly in `index.html` for the header mark.
- `js/spine.js` — deterministic category → color-index hash used for the game-card spine color.
- `js/toast.js` — toast notifications.
- `js/main.js` — orchestration only: view switching (`showAuthView`/`showAppView`), tab switching, event wiring, calling `api`, passing results to `render`. `handleAuthError(err)` is the shared 401 handler — call it in every `catch` for an authenticated request so an expired session bounces the user back to `#authView` instead of failing silently. `switchAuthMode('login' | 'register' | 'forgot')` toggles between the three `.auth-form`s via the `.is-active` class (not `hidden` — see the CSS gotcha above). The "Cadastrar" tab doubles as the edit form: `editingGameId` (module-level state) tracks whether `registerForm` is in create or edit mode; `enterEditMode(game)`/`exitEditMode()` toggle the panel title, submit button label, and the "Cancelar edição" link, and `handleRegisterSubmit` branches between `api.create`/`api.update` based on it. Switching to any other tab implicitly cancels an in-progress edit. The "Sortear" tab's `#filterCategory` dropdown is repopulated (`populateCategoryFilter`) every time that tab is opened, from the distinct `category` values in `api.list()` — there's no dedicated categories endpoint, this is derived client-side (shared with the collection filter below via `categoryOptionsHtml(games, selectedValue)`). `handleDraw` reads `#filterPlayers`/`#filterAge`/`#filterCategory` and passes them to `api.drawRandom(filters)` (server-side filtering, since we only want one result) — filter values persist across draws (not cleared automatically).
  - **Collection filters** (name/players/age/category, on the "Coleção" tab) are filtered client-side instead, since the whole list is already in memory: `allGames` (module state) holds the last `api.list(true)` response — `loadGames()` always fetches with `includeDeleted=true` so soft-deleted games are available to the "Incluir excluídos" checkbox (`#filterListShowDeleted`) without a second round-trip when it's toggled. `applyListFilters()` re-derives the visible list from it via `gameMatchesFilters(game, filters)` (which hides `deletedAt`-set games unless `filters.showDeleted` is true) and re-renders both the list and the stat tiles from the filtered subset (so the stats reflect what's currently shown, not the whole collection) — no network round-trip per keystroke. `gameMatchesFilters`'s players/age logic intentionally mirrors `boardgamesRepository.randomOneByUser`'s SQL filtering (a game missing `minPlayers`/`maxPlayers`/`minAge` isn't excluded by that specific filter) — keep the two in sync if you change one. `populateListCategoryFilter()` derives its options only from games matching the current showDeleted state, so the dropdown never offers a category that would yield an empty result. `loadGames()` refetches `allGames` and calls `applyListFilters()` (not a plain re-render) so edits/deletes elsewhere are picked up while current filter values are preserved. Deleted games render with reduced opacity and an "Excluído" badge (`renderGameList`/`gameCardTemplate` in `render.js`) and omit the edit/delete action buttons, since both would 404 against an already soft-deleted row.
  - **Documents list** uses the same "stage locally, reconcile on save" pattern as the game form itself: `currentLinks` (module state, `{ key, id, label, url }[]`) is what the UI renders and edits — `key` is a client-generated `crypto.randomUUID()` so unsaved rows (`id: null`) can still be added/removed before the game is even saved. `originalLinkIds` snapshots which link ids existed when entering edit mode. On submit, `reconcileLinks(gameId)` diffs `currentLinks` against that snapshot: anything without an `id` gets `api.createLink`'d, anything from the snapshot no longer present gets `api.removeLink`'d. This only runs *after* the game itself is created/updated (a new game has no id to attach links to until then).

### API surface

**Auth** (`/api/auth`)
- `POST /register` — `{ name, email, password }` (password min 6 chars). Creates the user, starts a session, sets the `sid` cookie.
- `POST /login` — `{ email, password }`. Generic `401` on any mismatch (doesn't reveal which field was wrong).
- `POST /logout` — clears the session (DB row + cookie).
- `GET /me` — current user (requires auth).
- `PATCH /me` — `{ name, currentPassword?, newPassword? }` (requires auth). `newPassword` requires a correct `currentPassword`. Email is intentionally not editable here — `usersRepository.updateName` only ever touches `name`; the profile form's email input is `readonly` and the controller ignores any `email` sent in the body.
- `POST /forgot-password` — `{ email }`. Always `200` with the same generic message, whether or not the email exists. Emails a `reset-password.html?token=...` link (1-hour expiry) when it does.
- `POST /reset-password` — `{ token, newPassword }`. `400` if the token is missing/invalid/expired. Invalidates the token and every existing session for that user on success.

**Boardgames** (`/api/boardgames`, all require auth)
- `GET /` — list the current user's games. `?includeDeleted=true` also returns soft-deleted games (with `deletedAt` set) alongside active ones; omitted/`false` behaves as before (only active games).
- `POST /` — add a game (`name` required; `minPlayers`, `maxPlayers`, `duration`, `category`, `imageUrl`, `minAge` optional). Server assigns `id` (`Date.now().toString()`), `userId` (from the session), and `createdAt`.
- `PUT /:id` — update a game's fields (same body shape as `POST`; only if it belongs to the current user, `404` otherwise). `id`, `userId`, `createdAt` are immutable.
- `DELETE /:id` — remove a game (only if it belongs to the current user)
- `GET /random` — return one random game owned by the current user, optionally filtered by query params: `players` (game's `minPlayers`/`maxPlayers` range must contain it — a game missing either bound isn't excluded by that bound), `minAge` (game's `minAge` must be `<= minAge`, i.e. "appropriate for this age"), `category` (exact match). `404` — message differs depending on whether filters were provided (`"Nenhum jogo encontrado com esses filtros."` vs. the no-games-at-all message), so the frontend can tell the two apart.
- `GET /:gameId/links` — list a game's documents
- `POST /:gameId/links` — add a document `{ label, url }` (`url` must match `/^https?:\/\//i`)
- `DELETE /:gameId/links/:linkId` — remove a document

### Data model

**User**: `id` (UUID), `name`, `email` (unique, lowercased), `passwordHash` (`scrypt salt:hash`, never sent to the client), `createdAt`.

**Boardgame**: `id, userId, name, minPlayers, maxPlayers, duration, category, imageUrl, minAge, createdAt` — all optional fields besides `name`, `userId` and `createdAt` are stored as `TEXT` columns, exactly as submitted (possibly `NULL`), not coerced to numbers server-side. `readAllByUser` orders by `createdAt ASC`; `randomOneByUser` uses `ORDER BY RANDOM() LIMIT 1`. Both responses include a `links` array (see below).

**Boardgame link/document**: `id, boardgameId, label, url, createdAt` — e.g. `{ label: "Regras base", url: "https://..." }`. A game can have any number; there's no "primary manual" field.

## Design system

Tabletop/felt-table visual identity, tokenized in `public/css/tokens.css`:

- **Color**: deep felt green (`--felt`) as the page surface, cream cardstock (`--card`) for panels/cards, `--ember` as the one primary-action accent. `--gold`, `--teal`, `--mustard`, `--plum` are secondary/spine accents — `spine.js` hashes a game's category to one of them (`spine-0`…`spine-4`) rather than assigning colors by hand.
- **Type**: `--font-display` (Fraunces) for headings/titles, `--font-body` (Inter) for UI copy, `--font-mono` (IBM Plex Mono) for stats/numbers — keep that role split when adding UI.
- **Signature element**: the "Sortear" tab draws a game via a flip-style die animation (`dice.js`) that resolves into a perforated raffle-ticket card (`.ticket` in `styles.css`) — this only appears once, on the felt background (not nested inside a cream `.panel`), so its punched-hole notches (`.ticket__perf::before/::after`, colored `var(--felt)`) blend correctly. If you rewrap `#drawStage` inside a `.panel`, update the notch color to match or the illusion breaks.
- **Auth screen**: reuses `.panel` (cream card) with an `.auth-toggle` pill switcher between the login and signup `.auth-form`s — same visual language as the tab system, not a separate style.
- **Documents**: `.doc-chip` (small teal pill, `--font-mono`, document icon) is how a game's links surface passively on the game-card and the draw ticket — read-only, opens in a new tab. `.link-row` (in the register/edit form) is the editable counterpart, cream-soft background with a label, an "Abrir ↗" link, and a remove button — deliberately a different, heavier treatment since it's an editing control, not just a display.

### Conventions to preserve

- Keep the layered backend structure (routes → controllers → repository) and the modular frontend (`public/css/*`, `public/js/*`) — don't collapse back into single-file `server.js`/`index.html`, this structure exists specifically to support future features.
- Data access goes through the repositories in `src/data/` only; controllers never touch `db.js`/`@libsql/client` directly. Every repository function is `async` — don't reintroduce synchronous `node:sqlite`-style calls.
- Deploying somewhere without persistent disk (serverless/ephemeral filesystems, or a free-tier host like Render) means the local-file fallback in `db.js` won't survive a restart — set `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` in that environment so `db.js` points at Turso instead. Nothing else in the code needs to change to switch between the two.
- Every new authenticated route must scope its data access by `req.user.id`, mirroring `boardgames.controller.js` — never trust a client-supplied user id.
- User-facing strings and UI copy are in Portuguese (pt-BR), written in an active, direct voice (e.g. toast/error copy says what happened and what to do, not a generic "erro ao..."); match that when adding new UI text or API error messages.
- No bundler/build step by design — frontend JS relies on native ES module `import`/`export` served as static files. If you add a module, reference it with an explicit relative path (and `.js` extension) from its importer.
- Don't send outbound email over SMTP — use an HTTP-based provider API instead (see `mailer.js`). SMTP ports are frequently blocked on free-tier hosts, and the failure mode is a silent hang (no error, no timeout by default), not a clean rejection — it's a bad category of bug to reintroduce.
