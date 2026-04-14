## v1.6.1 (2026-04-14)

### @createrington/server (1.6.0 → 1.6.1)
- Add legacy currency routes (`/api/legacy/currency`) mirroring all `/api/currency` endpoints but returning flat response payloads (no `ApiResponse` envelope) — allows pre-envelope mod clients to keep working by pointing at the legacy base URL via config, without needing a code update

## v1.6.0 (2026-04-14)

### @createrington/server (1.5.0 → 1.6.0)
- Add Createrington Assistant (admin chat) backend proxy — new `/api/admin-chat` routes forward admin requests to the claude-automation upstream over SSE, keeping the shared secret server-side and deriving identity from the authenticated JWT so browsers never see credentials
- Add forceloads sync endpoint (`POST /api/forceloads/sync`) for the opac-teams Minecraft mod — accepts a full-state payload of player and party chunk data (secured with mod JWT + server IP) and replaces the stored forceload state for the originating server; backed by new DB tables and query classes for forceload parties, members, and chunks
- Replace waitlist invitation tokens with per-applicant Discord invites — each accepted applicant now receives a unique, expiring Discord invite link (1 hour for auto-accepted, 7 days for manual invites) rather than a one-time token; the bot seeds an invite-use cache on startup and diffs guild invite counts on member-join to identify which invite was consumed and auto-trigger registration
- Add button + modal registration flow — new Discord interaction handlers allow applicants to self-register via a button in their invite DM, eliminating the need to run a slash command
- Standardise `/api/currency` endpoints on a shared response envelope — all currency mod endpoints now return `{ success, message, playerMessage?, data? }` via a new `respondSuccess` helper, providing a consistent shape for the Java client to parse
- Add mod JWT authentication to `POST /api/trains/crash` — the endpoint now requires a valid mod JWT token, bringing it in line with other secured mod endpoints
- Make `name` optional on `POST /api/currency/login` — the field is now a no-op (username is always taken from the JWT); making it optional prevents breaking existing mod clients that still send it
- Add forceloads tRPC admin router — new `admin.forceloads` procedures expose per-player and per-party chunk lists and stats for the admin dashboard
- Add waitlist cleanup service — a scheduled job purges orphaned waitlist entries (applicants who never joined after receiving an invite) and resets their status so the slot is freed
- Replace Node.js `--watch` with a chokidar-based dev watcher (`scripts/dev-watch.mjs`) — eliminates spurious self-restarts on Windows caused by the native file watcher
- Fix regex metacharacter injection in CLI scripts — user-supplied strings passed to `RegExp` constructors are now escaped, preventing accidental pattern breakage
- Move render page secret from query parameter to request header — avoids the secret appearing in server logs or browser history
- Unify mod-api Maven artifact publishing under `createrington-api` and trigger publication on any version bump to `gradle.properties`

### @createrington/client (0.2.2 → 0.2.3)
- Add Forceloads admin tool — new admin page displays forceloaded chunks per player and per party, with sortable tables, stats cards, and an empty state; data is fetched from the new `admin.forceloads` tRPC procedures
- Add Createrington Assistant chat widget — floating chat bubble in the admin area that streams replies from the claude-automation backend via SSE, supports action envelopes (`highlight`, `insert_embed`) to interact with the embed builder, renders markdown replies, persists action cards across sessions, and offers `@-mention` autocomplete for Createrington repos
- Add footer with social links — site footer now includes Discord and CurseForge icon links
- Validate Stripe checkout URL hostname strictly — the client now rejects redirect URLs that don't match the expected Stripe hostname, preventing open-redirect abuse
- Remove stale sidebar components and market entry that were no longer used

## v1.5.0 (2026-04-11)

### @createrington/server (1.4.0 → 1.5.0)
- Add `/profile`, `/activity`, and `/top` Discord slash commands that generate and post rendered player stat cards (profile summary, playtime heatmap, and leaderboard podium respectively)
- Add server-side render API endpoints (`/api/render/profile`, `/api/render/activity`, `/api/render/top`, `/api/render/compare`) that serve headless-rendered card pages for Discord embeds
- Add mod API Java library generator (`generate-mod-api`) that produces typed Java records and endpoint constants from structured spec files; initial spec files cover the `currency`, `presence`, and `trains` modules
- Add API documentation generator script (`generate-api-docs`) that produces `docs/api-reference.md` from spec files and JSDoc source parsing
- Add `/command-docs-panel` owner slash command that posts a persistent Discord embed listing all available commands, organised by group
- Replace hardcoded Discord command docs in the guides with dynamically fetched command data via a new `public.discordCommands` tRPC router, keeping the client always in sync with the actual command registry
- Improve `command-docs-panel` embed layout and design
- Guard rotating status service and structure pack rotation service so they are skipped in the dev environment, avoiding unintended Discord/server side effects during local development
- Set up CI workflow for automated mod API library publishing to Maven when spec files change

### @createrington/client (0.2.1 → 0.2.2)
- Add `ActivityRender`, `ProfileRender`, and `TopRender` headless pages used by the Discord slash commands to render player stat cards as images
- Switch profile and compare render pages to use the starlightskins API for Minecraft skin rendering, replacing the previous skinview3d library
- Add `skin-utils.ts` with a curated pool of verified skin poses for render card variety
- Replace hardcoded Discord commands guide content with dynamically loaded command data fetched from the server, so the guide always reflects the current command list
- Fix command docs tool to show an inline loading spinner while commands are being fetched

## v1.4.0 (2026-04-10)

### @createrington/server (1.3.0 → 1.4.0)
- Add `admin.changelog.get` tRPC endpoint — reads `CHANGELOG.md` from the project root and returns its raw content to authenticated admin clients; logs a warning on read failure instead of crashing

### @createrington/client (0.2.0 → 0.2.1)
- Add Changelog page to admin area — collapsible timeline UI that parses and renders all release entries from the project CHANGELOG.md, with expandable version sections and a "Latest" badge on the most recent release
- Show app version badge in sidebar footer — admins see the current version number (injected from root `package.json` at build time via Vite `define`) as a clickable link to the Changelog page; hidden when the sidebar is collapsed
- Add Changelog shortcut to user dropdown — admins can navigate directly to the changelog from the nav-user dropdown alongside the existing Admin Panel link
- Remove deprecated `baseUrl` from TypeScript config — aligns tsconfig with Vite 6 path-alias recommendations and eliminates compiler warnings
- Copy `CHANGELOG.md` to dist during production build — ensures the server can locate and read the changelog file at the expected path in deployed environments

## v1.3.0 (2026-04-10)

### @createrington/server (1.2.0 → 1.3.0)
- Add crypto net worth Discord leaderboard — a new `CRYPTO_NETWORTH` leaderboard type displays players ranked by their total crypto portfolio value, posted to the leaderboards channel and refreshed on the same hourly schedule as the playtime leaderboard
- Make `serverId` optional in leaderboard config — non-server leaderboards (like crypto) don't require a Minecraft server ID; the config type now reflects this and call sites default to `0` when unset
- Fix stale leaderboard message handling — when a Discord message has been deleted externally, editing it now returns a structured error instead of throwing; the service detects "not found" errors, deletes the stale DB record, and re-creates the message cleanly rather than crashing the refresh cycle

## v1.2.0 (2026-04-09)

### @createrington/server (1.1.1 → 1.2.0)
- Add admin inactivity management tRPC router — new `admin.inactivity` procedures expose paginated warning lists (filterable by status and username), summary stats, manual resolve/remove actions, and a force-trigger for the cleanup cycle
- Extract shared `removeInactiveWarning` helper — consolidates the full removal sequence (Discord guild kick → RCON whitelist removal → player DB delete → warning marked removed) into a single reusable function used by both the scheduled cleanup and the new manual-remove endpoint
- Add owner-only `/force-inactivity-cleanup` Discord slash command to trigger the cleanup cycle on demand without waiting for the next scheduled run
- Enable inactivity cleanup service on real production only — the guard now checks both `isProd` and `!isDevDeployment` so the dev deployment (dev.create-rington.com, which runs with `NODE_ENV=production`) is excluded
- Fix tsconfig `rootDir` and `baseUrl` deprecation errors — set explicit `rootDir: ".."`, remove deprecated `baseUrl`, and normalize `@/*` path alias to `./src/*`

### @createrington/client (0.1.2 → 0.2.0)
- Add Inactivity Management admin tool — full-page UI with status-tab navigation (active / expired / resolved / removed), paginated warning table, stats summary cards, and modal dialogs to manually resolve or remove individual warnings; destructive actions are gated to the production environment
- Add player-facing Structure Packs voting page — players can browse available packs, see which is currently active, boost packs with votes, and inspect the full mod list for each pack via an inline dialog
- Add pack mod list inspect dialog — pack cards in the admin and player views now include an "Inspect" button that opens a scrollable dialog listing all mods in the pack
- Rework admin tools page into a grouped compact list — tools are now organised under collapsible category headers with a compact row layout, replacing the previous icon-grid
- Overhaul chat new-message highlight animation — simplify to a single CSS `highlight-bg` keyframe animation per message group, removing the previous group-border-stitching logic (`prevHighlighted`/`nextHighlighted` props) that caused visual glitches
- Fix number input spinner arrows — hide browser-default increment/decrement arrows on `<input type="number">` elements via global CSS
- Fix chat highlight layout shift — prevent the highlight animation from causing content reflow by adjusting positioning and transition approach

## v1.1.2 (2026-04-07)

### @createrington/server (1.1.0 → 1.1.1)
- Suppress notifications for FAQ auto-reply embeds — both inline replies in the questions channel and standalone FAQ welcome messages now use the `SuppressNotifications` flag so they no longer ping users
- Add `flags` support to the shared Discord message service so any caller can pass message flags (e.g. silent sends)

### @createrington/client (0.1.1 → 0.1.2)
- Rework new-message highlighting in server chat — highlights now apply at the message-group level with a bordered container that visually connects consecutive highlighted groups, replacing the old per-row left-bar indicator
- Use CSS `animationEnd` event to clean up highlights after the fade-out completes, removing the previous `setTimeout`-based cleanup that could leave stale highlights or clear them too early

### Tooling
- Set up pre-commit hook with Husky + lint-staged to auto-format staged files with Prettier
- Disable Husky in CI to avoid hook failures in workflows
- Update pnpm from 10.29.3 to 10.33.0

## v1.1.1 (2026-04-05)

### @createrington/client (0.1.0 → 0.1.1)
- Fix teleport command in admin player detail — remove the player username from the `/tp` command so it copies as `/tp x y z` instead of `/tp username x y z`, matching the expected in-game format

## v1.1.0 (2026-04-05)

### @createrington/server (1.0.1 → 1.1.0)
- Add stat search tool with cross-category comparison — new `searchItems` and `compareItem` query methods let admins search for any Minecraft item key and compare counts across categories (e.g. picked up vs crafted) for all players, exposed via two new tRPC admin procedures
- Store player logout position (x/y/z coordinates and dimension) — when a player disconnects, their last position is persisted to the `player` table and used to display location info in the admin panel
- Validate mod position payload fields and preserve logout position during graceful server shutdown

### @createrington/client (0.0.1 → 0.1.0)
- Add Stat Search admin tool page — full-featured UI with item autocomplete, multi-category toggle, sortable comparison table, and suspicious-pattern highlighting (e.g. high pickup but zero crafted)
- Display player logout position in the admin player header — shows last known coordinates and dimension with a one-click `/tp` command copy button (only visible for offline players)
- Add Stat Search entry to the admin tools grid

## v1.0.1 (2026-04-04)

### @createrington/server (1.0.0 → 1.0.1)
- Tighten metadata validation across bans, strikes, and waitlist endpoints — replace permissive `z.any()` with a strict primitive union (`string | number | boolean | null`) to prevent arbitrary object injection
- Return human-readable relative time (e.g. "2 hours 15 minutes") in daily reward cooldown error responses instead of raw error strings
- Balance memecoin price engine to prevent upward drift — tighten mean reversion thresholds, increase correction strength, and neutralize upward bias in low/micro price tiers
- Skip AI article generation on dev deployments to avoid unnecessary OpenAI API costs
- Bump nodemailer from v7 to v8 and add dependency overrides to resolve all pnpm audit vulnerabilities

### @createrington/client (0.0.0 → 0.0.1)
- Fix vertical scroll bleed on player tabs mobile menu by adding `overflow-y-hidden`
- Replace broken `SignalZero` icon with `WifiOff` on the online players page offline state
