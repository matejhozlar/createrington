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
