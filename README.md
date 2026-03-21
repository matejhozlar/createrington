# Createrington Community Portal

![Node.js](https://img.shields.io/badge/Node.js-22-green?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)
![Discord](https://img.shields.io/badge/Discord-Integration-7289DA?logo=discord&logoColor=white)
![Minecraft](https://img.shields.io/badge/Minecraft-1.21.1-5E7C16?logo=minecraft&logoColor=white)
![tRPC](https://img.shields.io/badge/tRPC-v11-2596BE?logo=trpc&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-PostgreSQL-2496ED?logo=docker&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-Monorepo-F69220?logo=pnpm&logoColor=white)

Welcome to **Createrington**, a full-stack community portal that unifies a Minecraft server, Discord community, and browser-based web client into one seamless experience. The project features real-time player tracking, a fully simulated **in-game cryptocurrency market**, a **waitlist and application system**, **Stripe-powered donations**, an extensive **admin dashboard**, and deep **Discord bot integration** — all built on a type-safe TypeScript monorepo with tRPC, Drizzle ORM, and React.

- **Live:** [create-rington.com](https://create-rington.com)
- **Dev:** [dev.create-rington.com](https://dev.create-rington.com)
- **Discord:** [discord.gg/mtF6MDHj4Z](https://discord.gg/mtF6MDHj4Z)
- **Modpack:** [Createrington: Cogs & Steam on CurseForge](https://www.curseforge.com/minecraft/modpacks/createrington-cogs-steam)

## Project Goals

Createrington was designed to unify fragmented community platforms into a single portal. Instead of separate tools for Minecraft management, Discord automation, and user onboarding, this project merges everything into one cohesive ecosystem — with a novel in-game crypto economy layered on top to drive player engagement, retention, and community fun.

---

## Table of Contents

- [Key Features](#key-features)
- [Screenshots](#screenshots)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Installation & Setup](#installation--setup)
- [Running the Project](#running-the-project)
- [Scripts](#scripts)
- [API Overview](#api-overview)
- [WebSocket Events](#websocket-events)
- [Services](#services)
- [Crypto Market Module](#crypto-market-module)
- [Admin Dashboard](#admin-dashboard)
- [Discord Integration](#discord-integration)
- [Contributing](#contributing)
- [Related Projects](#related-projects)
- [Disclaimer](#disclaimer)

---

## Key Features

Createrington is a **complete ecosystem** linking Minecraft gameplay to Discord and a browser client. Highlights include:

### Discord OAuth & Verified Registration

Players log in via Discord OAuth. The server issues a short-lived JWT and a 30-day HTTP-only refresh token. Account verification links a Discord identity to a Minecraft UUID, gating access to protected features like trading and donations.

### Real-Time Chat Bridge

Two-way chat sync between Minecraft, Discord, and the web client using Socket.io and Discord webhooks. Messages appear across all three platforms in real time.

### Playtime Tracking & Automatic Role Assignment

The server tracks per-player session time and aggregates it into daily, hourly, and lifetime summaries. Discord roles are automatically assigned based on playtime tiers. A daily "Top Player" role rewards the most active player.

### In-Game Cryptocurrency Market

A fully simulated exchange with three token tiers (memecoins, stablecoins, blue-chips), limit and stop-loss orders, real-time price ticks over WebSocket, OHLCV candlestick charts, price alerts, watchlists, portfolio snapshots, and AI-generated market news. See [Crypto Market Module](#crypto-market-module) for details.

### Waitlist & Application System

Prospective players apply via the website. Admins review, approve, or decline applications from the admin dashboard. Approved players receive Discord notifications and are automatically whitelisted.

### Stripe-Powered Donations

One-time and recurring monthly donations via Stripe Checkout. Webhook processing grants in-game perks and supporter roles automatically upon successful payment.

### Interactive World Map

BlueMap integration renders an interactive 3D Minecraft world map directly in the browser.

### Comprehensive Admin Dashboard

A dedicated admin panel covering player management, moderation, economy tools, Discord embed/message builders, server metrics, audit logs, and more. See [Admin Dashboard](#admin-dashboard) for details.

### Support Ticket System

Players can open support tickets from the web client. Tickets are managed by admins through the dashboard with full action history.

### AI-Powered Market News

OpenAI generates in-character market news articles for the crypto economy, published to the news feed and Discord.

---

## Screenshots

### Homepage

![Homepage](screenshots/homepage.png)

### Crypto Market

![Crypto Market Overview](screenshots/crypto-market.png)

### Token Price Chart

![Token Chart with Candlesticks](screenshots/crypto-chart.png)

### Crypto Portfolio

![Player Portfolio](screenshots/crypto-portfolio.png)

### Live Player List

![Online Players](screenshots/online-players.png)

### Web Chat

![In-Browser Chat Bridge](screenshots/web-chat.png)

### Admin Dashboard

![Admin Dashboard Overview](screenshots/admin-dashboard.png)

### Admin Player Management

![Admin Player Management](screenshots/admin-players.png)

### Admin Crypto Panel

![Admin Crypto Token Management](screenshots/admin-crypto.png)

### Donation Page

![Donation Page](screenshots/donate.png)

---

## Architecture Overview

### Monorepo Structure

Three pnpm workspaces under `packages/`:

```
createrington/
├── packages/
│   ├── client/           # React 18 + Vite SPA (port 3000)
│   ├── server/           # Express 5 + tRPC backend (port 5001)
│   └── shared/           # Zod schemas + TypeScript types
├── db/
│   ├── docker-compose.yml
│   └── data/test-data.sql
├── docs/                 # Discord slash command docs
└── scripts/              # Build helpers
```

### Server

- **Express 5** with TypeScript — configures middleware, WebSockets, REST routes, tRPC, and Discord bots.
- **tRPC v11** — type-safe API layer mounted at `/trpc`, with three access levels: `publicProcedure`, `userProcedure`, `adminProcedure`.
- **Drizzle ORM** — schema-first PostgreSQL access. All business logic lives in application code; no DB functions or triggers.
- **Custom DI container** (`services/container.ts`) — services with async lifecycle are registered and resolved via `getService<T>(Services.KEY)`.
- **Two Discord bot instances** — main bot (slash commands, events, leaderboards) and web bot (OAuth, role assignment).
- **Socket.io** — real-time events for player status, crypto prices, market events, and in-game chat.
- **Winston** — global structured logger with daily rotating log folders.

### Client

- **React 18 + Vite** — SPA with Vite dev proxy routing `/api`, `/trpc`, and `/socket.io` to the backend.
- **tRPC + React Query** — data fetching with full type safety from server to client.
- **Tailwind CSS v4** — dark theme using OkLCH color space.
- **Shadcn/ui** (new-york style) — component library built on Radix UI primitives.
- **Socket.io-client** — WebSocket connection with manual reconnection and exponential backoff.

### Shared

- Zod schemas for input validation (shared between server and client).
- TypeScript types for auth roles, socket events, and DB entities (auto-generated from schema).

### Type Sharing (tRPC)

The server exports its `AppRouter` type via the `@createrington/server/trpc` package export. The client imports it as a type-only import, giving end-to-end type safety with zero runtime overhead.

```typescript
// client
import type { AppRouter } from "@createrington/server/trpc";
```

---

## Tech Stack

<p align="center">
  <img src="https://skillicons.dev/icons?i=nodejs,ts,react,postgres,express,discord,docker,vite,tailwind" />
</p>

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, Shadcn/ui, Radix UI |
| Backend | Node.js 22, Express 5, TypeScript |
| API | tRPC v11, REST (Express routes) |
| Database | PostgreSQL 15 (Docker), Drizzle ORM, drizzle-kit |
| Real-time | Socket.io (server + client) |
| Auth | Discord OAuth, JWT (access token) + HTTP-only cookie (refresh) |
| Payments | Stripe (Checkout Sessions, webhook processing) |
| Discord | Discord.js v14 (two bot instances) |
| Charts | Recharts, lightweight-charts (TradingView-style) |
| AI | OpenAI API (market news generation) |
| Email | Nodemailer (SMTP) |
| Rendering | Puppeteer + Canvas (image generation) |
| Maps | BlueMap (Minecraft world map) |
| Monorepo | pnpm workspaces |
| Testing | Vitest (unit + integration) |

---

## Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/) v9+
- [Docker](https://www.docker.com/) (for PostgreSQL)
- Discord application with a bot token and OAuth2 credentials
- Stripe account (for donations)
- Minecraft server with RCON enabled

### Cloning & Installing

```bash
git clone https://gitea.matejhoz.com/Createrington/app.git createrington
cd createrington
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env` in `packages/server/` and fill in the required values:

```bash
cp packages/server/.env.example packages/server/.env
```

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgres://user:pass@localhost:5433/createrington`) |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `DISCORD_MAIN_TOKEN` | Main bot token |
| `DISCORD_WEB_TOKEN` | Web/OAuth bot token |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord application client secret |
| `DISCORD_GUILD_ID` | Your Discord server (guild) ID |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `OPENAI_API_KEY` | OpenAI API key (for market news) |
| `RCON_HOST` | Minecraft server RCON host |
| `RCON_PORT` | Minecraft server RCON port |
| `RCON_PASSWORD` | Minecraft server RCON password |
| `SMTP_HOST` | SMTP server host |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `WEBSITE_URL` | Public website URL (e.g. `https://create-rington.com`) |

### Database Setup

Start the PostgreSQL Docker container, apply Drizzle migrations, and seed test data:

```bash
pnpm db:up       # Start PostgreSQL container on port 5433
pnpm db:migrate  # Apply Drizzle migrations to create all tables
pnpm db:seed     # Load test data
```

Or reset everything in one command:

```bash
pnpm db:reset    # Wipe DB, run migrations, seed test data
```

### Discord Setup

Scrape your Discord server's roles and channels into the local config, then deploy slash commands:

```bash
pnpm scrape-discord    # Sync Discord roles/channels to discord-entities.json
pnpm deploy-commands   # Register slash commands with Discord
```

### Code Generation

After any schema changes, regenerate TypeScript types and query classes:

```bash
pnpm generate
```

---

## Running the Project

### Development

Run the full development stack (server, client, and type watcher) in one command:

```bash
pnpm dev
```

Or start individual processes:

```bash
pnpm dev:server   # Express + tRPC on port 5001 (tsx watch)
pnpm dev:client   # Vite on port 3000 (with proxy to :5001)
pnpm dev:types    # Watch mode tRPC type declarations
```

### Production

```bash
pnpm build        # Full pipeline: generate → shared → server → client → dist
pnpm start        # Run production build (node dist/server/src/server.js)
```

The build pipeline runs: `tsc` → `tsc-alias` (resolve path aliases) → `post-build.ts` (add `.js` extensions for ESM) → `copyfiles` (copy static assets) → Vite build for the client.

---

## Scripts

### Root

| Script | Description |
|---|---|
| `pnpm dev` | Start all dev processes concurrently |
| `pnpm build` | Full production build pipeline |
| `pnpm start` | Run the production server |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm generate` | Regenerate DB types + query classes, then typecheck |
| `pnpm generate:ci` | Same as `generate` but skips typecheck |
| `pnpm test` | Run server tests in watch mode |
| `pnpm test:unit` | Unit tests only |
| `pnpm test:integration` | Integration tests only |

### Database

| Script | Description |
|---|---|
| `pnpm db:up` | Start PostgreSQL Docker container (port 5433) |
| `pnpm db:down` | Stop the container |
| `pnpm db:reset` | Wipe DB, run migrations, seed test data |
| `pnpm db:seed` | Load test data only |
| `pnpm db:shell` | Open a `psql` shell inside the container |
| `pnpm db:generate` | Generate Drizzle migration SQL from schema changes |
| `pnpm db:migrate` | Apply pending migrations to the running database |
| `pnpm db:destroy` | Remove container, images, and volumes |
| `pnpm db:logs` | Tail PostgreSQL container logs |
| `pnpm pgadmin` | Start pgAdmin container |

### Discord

| Script | Description |
|---|---|
| `pnpm scrape-discord` | Regenerate `discord-entities.json` (roles, channels, categories) |
| `pnpm deploy-commands` | Deploy Discord slash commands to the configured guild |

---

## API Overview

The API surface is split between **tRPC procedures** (primary, type-safe) and a thin layer of **Express REST routes** (webhooks, OAuth redirect, file uploads).

### tRPC Routers

#### Public (no auth required)

| Namespace | Procedures | Description |
|---|---|---|
| `servers` | `list`, `get` | Server status, player counts |
| `players` | `list`, `get`, `getByServer` | Player stats, online status, ranks |
| `waitlists` | `apply` | Submit a join application |
| `metrics` | `summary`, `activity` | Public community metrics |
| `crypto` | `listTokens`, `getToken`, `getPriceHistory`, `getMarketEvents`, `getNews`, `getLeaderboard` | Market data, charts, news |

#### User (requires verified account)

| Namespace | Procedures | Description |
|---|---|---|
| `account` | `get`, `update`, `getPlaytime`, `getStats` | Profile, settings, playtime |
| `achievements` | `list`, `get` | Achievement progress |
| `crypto` | `getPortfolio`, `getHoldings`, `trade`, `placeOrder`, `cancelOrder`, `getOrders`, `getTransactions`, `getAlerts`, `createAlert`, `deleteAlert`, `getWatchlist`, `addToWatchlist`, `removeFromWatchlist` | Trading, orders, portfolio, alerts |
| `donations` | `createCheckoutSession`, `list` | Stripe checkout, donation history |

#### Admin (requires admin flag)

| Namespace | Procedures | Description |
|---|---|---|
| `dashboard` | `getMetrics`, `getCharts` | KPIs, activity summaries |
| `players` | `list`, `get`, `ban`, `unban`, `adjustBalance`, `issueStrike`, `getAuditLog` | Full player management |
| `servers` | `list`, `get` | Server details |
| `waitlist` | `list`, `approve`, `decline` | Application review |
| `crypto` | `listTokens`, `createToken`, `updateToken`, `deleteToken`, `overridePrice`, `triggerEvent` | Token management |
| `donations` | `list` | Donation tracking |
| `embeds` | `list`, `get`, `create`, `update`, `delete` | Discord embed presets |
| `autoMessages` | `list`, `create`, `update`, `delete` | Scheduled Discord messages |
| `announcements` | `send` | In-game broadcast announcements |
| `faq` | `list`, `create`, `update`, `delete` | Knowledge base editor |
| `logs` | `list` | Admin action audit trail |
| `discordCommands` | `list` | Slash command introspection |
| `metrics` | `growth`, `economy`, `moderation` | Advanced analytics |

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/auth/discord` | Initiate Discord OAuth flow |
| GET | `/auth/discord/callback` | OAuth callback, issues JWT |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/webhooks/stripe` | Stripe webhook receiver |
| GET | `/api/players` | Live player list (used by Minecraft plugin) |
| POST | `/api/verify` | Minecraft login token verification |

---

## WebSocket Events

The server uses Socket.io with a subscription model. Clients subscribe to specific data streams.

### Subscription Types

| Type | Description |
|---|---|
| `SERVER_STATUS` | Server health and player counts |
| `PLAYERS` | Player online/offline status changes |
| `MESSAGES` | In-game chat relay |
| `CRYPTO_MARKET` | Price ticks, orders, market events, news |
| `ALL` | All streams |

### Events

| Event | Direction | Description |
|---|---|---|
| `SUBSCRIBE` | Client → Server | Subscribe to a data stream |
| `UNSUBSCRIBE` | Client → Server | Unsubscribe from a stream |
| `REQUEST_INITIAL_DATA` | Client → Server | Request bulk current state |
| `INITIAL_DATA` | Server → Client | Bulk state response |
| `UPDATE_SERVER_STATUS` | Server → Client | Server player count / health update |
| `UPDATE_PLAYERS` | Server → Client | Player list update |
| `UPDATE_MESSAGE` | Server → Client | New in-game/Discord chat message |
| `UPDATE_CRYPTO_PRICES` | Server → Client | Price tick for all tokens |
| `UPDATE_CRYPTO_ORDER` | Server → Client | Personal order fill or cancellation |
| `CRYPTO_MARKET_EVENT` | Server → Client | Major event (crash, IPO, new listing) |
| `CRYPTO_NEWS` | Server → Client | New AI-generated news article |

---

## Services

Key services registered in the DI container (`packages/server/src/services/container.ts`):

| Service Key | Description |
|---|---|
| `DATABASE` | Drizzle ORM connection pool |
| `HTTP_SERVER` | Express application instance |
| `DISCORD_MAIN_BOT` | Main Discord bot (commands, events, leaderboards) |
| `DISCORD_WEB_BOT` | Web Discord bot (OAuth, role assignments) |
| `WEBSOCKET_SERVICE` | Socket.io server + subscription room manager |
| `MESSAGE_CACHE` | Discord message cache for webhook deduplication |
| `PLAYTIME_MANAGER_SERVICE` | Session tracking and online status synchronization |
| `TICKET_SERVICE` | Support ticket lifecycle management |
| `LEADERBOARD_SERVICE` | Playtime and economy leaderboard aggregation |
| `PLAYER_BAN_SERVICE` | Temporary and permanent ban management |
| `CRYPTO_MARKET_SERVICE` | Price ticks, order matching, market events, IPOs |
| `DONATION_SERVICE` | Stripe webhook processing and perk fulfillment |

Services with async lifecycle (Discord bots, WebSocket, etc.) are accessed via `getService<T>(Services.KEY)`. Stateless singletons are imported directly.

---

## Crypto Market Module

The in-game economy is a fully simulated exchange with realistic market dynamics.

### Token Tiers

| Tier | Description |
|---|---|
| **Memecoins** | Highly volatile; periodically spawned and can crash to zero |
| **Stablecoins** | Pegged to €1, used as a base currency for the economy |
| **Blue-chips** | Mean-reverting, less volatile, behave like blue-chip stocks |

### Trading Features

- **Market orders** — Immediate execution at current price
- **Limit orders** — Execute at a specified price or better
- **Stop-loss orders** — Auto-sell when price drops to a threshold
- **Take-profit orders** — Auto-sell when price reaches a target
- **Partial fills** — Large orders can be partially matched
- **Order expiry** — Stale orders are cancelled on a 5-minute cycle

### Market Data

- Real-time price ticks broadcast over WebSocket
- OHLCV candlestick history at 1m, 5m, 1h, and 1d aggregations (TradingView-style charts)
- 24h price change % and volume tracking per token
- Price alerts with WebSocket notifications
- Watchlist management per user

### Portfolio Tools

- Daily and weekly portfolio value snapshots
- Transaction history with full buy/sell audit trail
- Wealth and return % leaderboards

### Market Events

Random and scheduled events keep the market dynamic:

- **Crash events** — Sudden price collapses (removes tokens below a threshold)
- **New listings** — Fresh memecoins spawned with an initial price
- **IPOs** — Structured initial public offerings with a lock period and price discovery
- **Seasonal events** — Holiday or in-game seasonal modifiers

### AI News

OpenAI generates in-character market news articles that are published to the web news feed and broadcast to a Discord channel, adding narrative depth to the economy.

---

## Admin Dashboard

The admin panel (accessible at `/admin`) provides complete control over the community.

### Player Management

- View full player profiles (Discord, Minecraft UUID, playtime, balance, bans, strikes)
- Issue temporary or permanent bans with a reason
- Apply strikes categorized by type (PvP, theft, griefing, harassment, etc.)
- Adjust player balances manually with logged audit entries
- View admin action audit logs per player

### Moderation

- Ban and strike history with searchable, filterable tables
- Full audit trail: who took the action, when, what changed, and why

### Economy Tools

- View and manage all crypto tokens (create, update, delete, override price)
- Trigger market events manually (crash, new listing, IPO)
- View donation history and Stripe payment records

### Discord Tools

- **Embed Builder** — WYSIWYG editor for Discord embed presets
- **Auto-Messages** — Schedule recurring or random messages to Discord channels
- **Announcements** — Broadcast messages to the Minecraft server in-game
- **Command Docs** — Introspect and browse registered slash commands

### Content Management

- **FAQ Editor** — Create and edit the public knowledge base
- **Waitlist** — Review, approve, or decline player applications

### Analytics

- Growth metrics (new players, active players, retention)
- Economy health (trading volume, market cap, balance distribution)
- Moderation stats (bans, strikes, ticket volume)
- Server metrics (player load per server, playtime distribution)

---

## Discord Integration

Two bot instances serve different roles:

### Main Bot

- Handles slash commands (`/ban`, `/unban`, `/balance`, `/give`, etc.)
- Posts to Discord from web events (announcements, news, embeds)
- Manages automatic role assignments (playtime tiers, top player, supporter)
- Relays in-game Minecraft chat to a Discord channel
- Posts leaderboard embeds on a schedule

### Web Bot

- Handles Discord OAuth flow for web login
- Assigns roles after successful account verification

### Slash Commands

Slash commands are defined in `packages/server/src/discord/commands/` and deployed via `pnpm deploy-commands`. See `docs/discord-commands.md` for the full auto-generated command reference.

---

## Contributing

- Format: Biome (spaces, double quotes, semicolons, trailing commas)
- Commit format: `type(scope): description` — e.g. `feat(server): add player ban endpoint`
- Allowed types: `feat`, `fix`, `chore`, `refactor`
- Scopes: `server`, `client`, `shared` (or omit if change spans multiple packages)
- Tests: Vitest (`pnpm test:unit`, `pnpm test:integration`)
- PR base: always target `dev`
- Never push directly to `dev` or `main`

---

## Related Projects

- [**Createrington Currency**](https://github.com/matejhozlar/createrington-currency) — Minecraft mod providing in-game currency integration with this platform
- [**Createrington: Cogs & Steam**](https://www.curseforge.com/minecraft/modpacks/createrington-cogs-steam) — The official Minecraft modpack

---

## Disclaimer

Not affiliated with Mojang, Microsoft, or Discord.

> The in-game cryptocurrency market is a simulated economy for entertainment purposes only and has no real-world monetary value.
