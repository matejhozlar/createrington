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
