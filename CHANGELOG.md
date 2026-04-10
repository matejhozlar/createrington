## [2026-04-10]

### @createrington/server (1.2.0 → 1.3.0)
- Add crypto net worth Discord leaderboard — a new `CRYPTO_NETWORTH` leaderboard type displays players ranked by their total crypto portfolio value, posted to the leaderboards channel and refreshed on the same hourly schedule as the playtime leaderboard
- Make `serverId` optional in leaderboard config — non-server leaderboards (like crypto) don't require a Minecraft server ID; the config type now reflects this and call sites default to `0` when unset
- Fix stale leaderboard message handling — when a Discord message has been deleted externally, editing it now returns a structured error instead of throwing; the service detects "not found" errors, deletes the stale DB record, and re-creates the message cleanly rather than crashing the refresh cycle

## [2026-04-09]

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

## [2026-04-07]

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

## [2026-04-05]

### @createrington/client (0.1.0 → 0.1.1)
- Fix teleport command in admin player detail — remove the player username from the `/tp` command so it copies as `/tp x y z` instead of `/tp username x y z`, matching the expected in-game format

## [2026-04-05]

### @createrington/server (1.0.1 → 1.1.0)
- Add stat search tool with cross-category comparison — new `searchItems` and `compareItem` query methods let admins search for any Minecraft item key and compare counts across categories (e.g. picked up vs crafted) for all players, exposed via two new tRPC admin procedures
- Store player logout position (x/y/z coordinates and dimension) — when a player disconnects, their last position is persisted to the `player` table and used to display location info in the admin panel
- Validate mod position payload fields and preserve logout position during graceful server shutdown

### @createrington/client (0.0.1 → 0.1.0)
- Add Stat Search admin tool page — full-featured UI with item autocomplete, multi-category toggle, sortable comparison table, and suspicious-pattern highlighting (e.g. high pickup but zero crafted)
- Display player logout position in the admin player header — shows last known coordinates and dimension with a one-click `/tp` command copy button (only visible for offline players)
- Add Stat Search entry to the admin tools grid

## [2026-04-04]

### @createrington/server (1.0.0 → 1.0.1)
- Tighten metadata validation across bans, strikes, and waitlist endpoints — replace permissive `z.any()` with a strict primitive union (`string | number | boolean | null`) to prevent arbitrary object injection
- Return human-readable relative time (e.g. "2 hours 15 minutes") in daily reward cooldown error responses instead of raw error strings
- Balance memecoin price engine to prevent upward drift — tighten mean reversion thresholds, increase correction strength, and neutralize upward bias in low/micro price tiers
- Skip AI article generation on dev deployments to avoid unnecessary OpenAI API costs
- Bump nodemailer from v7 to v8 and add dependency overrides to resolve all pnpm audit vulnerabilities

### @createrington/client (0.0.0 → 0.0.1)
- Fix vertical scroll bleed on player tabs mobile menu by adding `overflow-y-hidden`
- Replace broken `SignalZero` icon with `WifiOff` on the online players page offline state
