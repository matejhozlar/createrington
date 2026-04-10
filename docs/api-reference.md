# API Reference

> Auto-generated from Express route and controller definitions. Do not edit manually.
> Generated: 2026-04-10

## Table of Contents

- **[Auth](#auth)** (7) — `GET /api/auth/discord`, `POST /api/auth/discord/callback`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/logout-all`, `GET /api/auth/status`
- **[Messages](#messages)** (1) — `POST /api/messages`
- **[Skin](#skin)** (1) — `GET /api/skin/:uuid`
- **[Donations](#donations)** (1) — `POST /api/donations/webhook`
- **[Currency](#currency)** (10) — `POST /api/currency/login`, `GET /api/currency/balance`, `POST /api/currency/pay`, `POST /api/currency/deposit`, `POST /api/currency/withdraw`, `GET /api/currency/history`, `GET /api/currency/top`, `POST /api/currency/daily`, `POST /api/currency/lottery/start`, `POST /api/currency/lottery/join`
- **[Presence](#presence)** (2) — `POST /api/presence`, `POST /api/presence/heartbeat`
- **[Trains](#trains)** (1) — `POST /api/trains/crash`
- **[Render](#render)** (5) — `GET /api/render/compare`, `GET /api/render/profile`, `GET /api/render/activity`, `GET /api/render/top`, `GET /api/render/crypto-chart`
- **[Internal Sync](#internal-sync)** (2) — `POST /api/internal/presence`, `POST /api/internal/presence/heartbeat`

## Authentication

| Scheme | Description |
|--------|-------------|
| **Bearer JWT** | User access token from Discord OAuth. Sent as `Authorization: Bearer {token}` |
| **Mod JWT** | Short-lived token (10 min) issued by `POST /api/currency/login`. Same Bearer header |
| **Server IP** | Request must originate from a whitelisted Minecraft server IP |
| **Sync Secret** | `X-Sync-Secret` header for cross-environment sync |
| **Puppeteer Secret** | `?secret=` query param for internal render service |
| **Stripe Signature** | `stripe-signature` header for webhook verification |

---

## Auth

Discord OAuth flow, JWT session management, and token refresh.

**Base path:** `/api/auth` · **Auth:** Public + Bearer JWT

### GET `/api/auth/discord`

Returns Discord OAuth authorization URL

**Auth:** `Public`

---

### POST `/api/auth/discord/callback`

Handles Discord OAuth callback.
Returns short-lived access token in body + sets refresh token as httpOnly cookie.

**Auth:** `Public`

**Body:**

```json
{ code: string, state?: string }
```

---

### POST `/api/auth/refresh`

Rotate refresh token (cookie-based, no Bearer needed).
Returns new access token + sets new refresh cookie.
Re-fetches user data from DB for fresh role info.

**Auth:** `Public`

---

### POST `/api/auth/logout`

Revoke session via cookie + clear cookie.
Public route — works even without a valid Bearer token.

**Auth:** `Optional Auth`

---

### GET `/api/auth/me`

Returns current user information from JWT

**Auth:** `User` (Bearer JWT)

---

### POST `/api/auth/logout-all`

Revoke all sessions for the authenticated user.
Requires valid Bearer token (user auth).

**Auth:** `User` (Bearer JWT)

---

### GET `/api/auth/status`

Check authentication status

**Auth:** `User` (Bearer JWT)

---

## Messages

Send messages to Minecraft server Discord channels via the web client.

**Base path:** `/api/messages` · **Auth:** Bearer JWT (user)

### POST `/api/messages`

Sends a message to the Discord channel linked to a Minecraft server.
Validates the uploaded image if present, resolves the channel for the
given `serverId`, prepends the sender's display name to the text content,
and forwards the payload to WEB_MESSAGE_SERVICE.

**Auth:** `User` (Bearer JWT)

---

## Skin

Proxies Minecraft skin requests to avoid CORS issues with external APIs.

**Base path:** `/api/skin` · **Auth:** Public

### GET `/api/skin/:uuid`

Fetch a player skin by Minecraft UUID

**Auth:** `Public`

---

## Donations

Stripe webhook processing for donation and subscription events.

**Base path:** `/api/donations` · **Auth:** Stripe signature

### POST `/api/donations/webhook`

Stripe sends signed webhook events here.
Verifies the signature, then delegates to DonationService.

**Auth:** `None` (raw handler)

---

## Currency

In-game economy endpoints called by the Minecraft mod: balances, transfers, withdrawals, daily rewards, and leaderboard.

**Base path:** `/api/currency` · **Auth:** Server IP + Mod JWT

### POST `/api/currency/login`

Creates a short-lived JWT for subsequent currency requests.
Only requires server IP verification (no existing JWT needed).

**Auth:** `Server IP`

**Body:**

```json
{ uuid: string, name: string }
```

---

### GET `/api/currency/balance`

Returns the player's current balance.

**Auth:** `Server IP + Mod JWT`

---

### POST `/api/currency/pay`

Transfers currency between two players.

**Auth:** `Server IP + Mod JWT`

**Body:**

```json
{ toUuid: string, amount: number, fromUuid?: string }
```

---

### POST `/api/currency/deposit`

Adds currency to the authenticated player's balance.

**Auth:** `Server IP + Mod JWT`

**Body:**

```json
{ amount: number, reason?: string }
```

---

### POST `/api/currency/withdraw`

Withdraws currency from the authenticated player's balance.
Total withdrawn = denomination * count.

**Auth:** `Server IP + Mod JWT`

**Body:**

```json
{ denomination: number, count: number }
```

---

### GET `/api/currency/history`

Returns paginated transaction history for the authenticated player.

**Auth:** `Server IP + Mod JWT`

---

### GET `/api/currency/top`

Returns top 10 players by balance.

**Auth:** `Server IP + Mod JWT`

---

### POST `/api/currency/daily`

Claims the daily reward for the authenticated player.

**Auth:** `Server IP + Mod JWT`

---

### POST `/api/currency/lottery/start`

Starts a new lottery round with the given buy-in amount.

**Auth:** `Server IP + Mod JWT`

**Body:**

```json
{ amount: number }
```

---

### POST `/api/currency/lottery/join`

Joins an active lottery round with the given buy-in amount.

**Auth:** `Server IP + Mod JWT`

**Body:**

```json
{ amount: number }
```

---

## Presence

Player join/leave tracking and heartbeat reconciliation from the Minecraft mod.

**Base path:** `/api/presence` · **Auth:** Server IP + Mod JWT

### POST `/api/presence`

Records a player join or leave event from a Minecraft server.
Resolves the target server from either the `serverId` field in the request
body or the verified server IP attached by the middleware. Dispatches to the
correct PlaytimeService instance and responds with the echoed event details.

**Auth:** `Server IP + Mod JWT`

**Body:**

```json
{
 minecraftUsername: string,
 uuid: string,
 state: "joined" | "left",
 timestamp: number,
 serverId?: number
}
```

---

### POST `/api/presence/heartbeat`

Receives a heartbeat from the mod containing the full online player list.
Reconciles tracked sessions against reality to clean up stale sessions.

**Auth:** `Server IP + Mod JWT`

**Body:**

```json
{
 players: Array<{ uuid: string, username: string }>,
 timestamp?: number,
 serverId?: string
}
```

---

## Trains

Train crash event reporting from the Create: Trains Minecraft mod.

**Base path:** `/api/trains` · **Auth:** Server IP

### POST `/api/trains/crash`

Receives train crash data from the Minecraft mod and sends
a notification embed to the Cogs & Steam notifications channel.

**Auth:** `Server IP`

---

## Render

Internal data endpoints consumed by PuppeteerService for image generation. Not user-accessible.

**Base path:** `/api/render` · **Auth:** Puppeteer secret

### GET `/api/render/compare`

Returns comparison data for two players identified by Discord ID. Protected by puppeteer secret — not accessible to regular users.

**Auth:** `Puppeteer Secret`

---

### GET `/api/render/profile`

Returns profile data for a single player identified by Discord ID. Protected by puppeteer secret — not accessible to regular users.

**Auth:** `Puppeteer Secret`

---

### GET `/api/render/activity`

Returns daily playtime data for the last 365 days, aggregated across servers. Protected by puppeteer secret — not accessible to regular users.

**Auth:** `Puppeteer Secret`

---

### GET `/api/render/top`

Returns top 3 players for a given Minecraft stat category + item. Protected by puppeteer secret — not accessible to regular users.

**Auth:** `Puppeteer Secret`

---

### GET `/api/render/crypto-chart`

Returns token data and OHLCV price history for the chart render page. Protected by puppeteer secret — not accessible to regular users.

**Auth:** `Puppeteer Secret`

---

## Internal Sync

Cross-environment presence sync. Receives forwarded events from the dev server. Only active when sync secret is configured.

**Base path:** `/api/internal/presence` · **Auth:** X-Sync-Secret header

### POST `/api/internal/presence`

Processes a forwarded presence event from the dev server.
Validates the payload, ensures the test server entry exists,
and delegates to the PlaytimeRepository for session management.

**Auth:** `Sync Secret`

**Body:**

```json
{
  uuid: string,
  username: string,
  state: "joined" | "left",
  timestamp?: string (ISO 8601)
}
```

---

### POST `/api/internal/presence/heartbeat`

Processes a forwarded heartbeat from the dev server.
Receives the full online player list from the dev test server and
reconciles sessions on the production test server entry — ending
stale sessions and starting missing ones.

**Auth:** `Sync Secret`

**Body:**

```json
{
  players: Array<{ uuid: string, username: string }>,
  timestamp?: string (ISO 8601)
}
```

---
