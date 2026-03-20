# Discord Commands

> Auto-generated from slash command definitions. Do not edit manually.
> Generated: 2026-03-20

## Table of Contents

- **Admin** — [/cooldown](#cooldown), [/leaderboard](#leaderboard), [/message](#message), [/notification-panel](#notification-panel), [/purge](#purge), [/server-panel](#server-panel), [/ticket](#ticket), [/ticket-panel](#ticket-panel)
- **User** — [/compare](#compare), [/crypto](#crypto), [/daily](#daily), [/history](#history), [/list](#list), [/lottery](#lottery), [/money](#money), [/pay](#pay), [/ping](#ping), [/playtime](#playtime), [/seen](#seen), [/skin](#skin), [/status](#status), [/username](#username)
- **Public** — [/register](#register), [/verify](#verify)

## Admin Commands

### /cooldown

Manage command cooldowns

**Permission:** Discord Administrator · **Cooldown:** None · **Env:** prod

#### `reset`

Reset cooldown for a user

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | User | Yes | User to reset cooldowns for |

#### `reset-command`

Reset all cooldowns for a specific command

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `command` | String | Yes | Command name to reset |

#### `stats`

View cooldown statistics

---

### /leaderboard

Manage leaderboards

**Permission:** Admin · **Cooldown:** None · **Env:** prod

#### `create`

Create or update leaderboard

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | String | Yes | Leaderboard type — Choices: `playtime` |

#### `refresh`

Manually refresh leaderboard

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | String | Yes | Leaderboard type — Choices: `playtime` |

#### `refresh-all`

Refresh all leaderboards

---

### /message

Send a custom message to this channel (owner only)

**Permission:** Discord Administrator · **Cooldown:** None · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `content` | String | Yes | The message to send |

---

### /notification-panel

Create or update the notification selection panel

**Permission:** Owner · **Cooldown:** None · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `message_id` | String | No | Message ID of an existing panel to update (sends new if omitted) |

---

### /purge

Purge up to 100 recent messages

**Permission:** Discord Administrator · **Cooldown:** None · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `count` | Integer (min: 1, max: 100) | Yes | Number of messages to purge (1-100) |
| `user` | User | No | Only purge messages from this user |

---

### /server-panel

Create or update the server selection panel

**Permission:** Owner · **Cooldown:** None · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `message_id` | String | No | Message ID of an existing panel to update (sends new if omitted) |

---

### /ticket

Manage tickets

**Permission:** Admin · **Cooldown:** 5s (user) · **Env:** prod

#### `open`

Open a ticket for a user

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | User | Yes | Discord user |

---

### /ticket-panel

Create or refresh the ticket panel

**Permission:** Discord Administrator · **Cooldown:** None · **Env:** prod

*No options.*

---

## User Commands

### /compare

Compare stats between two players

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `player1` | User | Yes | First player |
| `player2` | User | No | Second player (defaults to you) |

---

### /crypto

Trade crypto tokens

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

#### `buy`

Buy crypto tokens

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `symbol` | String | Yes | Token symbol (e.g. FLF) |
| `amount` | Integer (min: 1) | Yes | Number of tokens to buy |

#### `sell`

Sell crypto tokens

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `symbol` | String | Yes | Token symbol (e.g. FLF) |
| `amount` | Integer (min: 1) | Yes | Number of tokens to sell |

#### `portfolio`

View your crypto portfolio

#### `leaderboard`

View the crypto trading leaderboard

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | String | No | Leaderboard ranking type — Choices: `networth`, `pnl`, `volume` |

#### `market`

View market summary and stats

#### `chart`

View a token's price chart

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `symbol` | String | Yes | Token symbol (e.g. FLF) |
| `interval` | String | No | Chart time interval — Choices: `tick`, `minute`, `hourly`, `daily` |

#### `alert` (group)

Manage price alerts

#### `alert add`

Create a price alert

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `symbol` | String | Yes | Token symbol (e.g. FLF) |
| `price` | Number (min: 0.000001) | Yes | Target price to trigger the alert |
| `direction` | String | Yes | Alert when price goes above or below target — Choices: `above`, `below` |

#### `alert remove`

Remove a price alert

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | Integer | Yes | Alert ID to remove |

#### `alert list`

List your active price alerts

---

### /daily

Claim your daily reward

**Permission:** None · **Cooldown:** 10s (user) · **Env:** prod

*No options.*

---

### /history

View your recent balance transactions

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

*No options.*

---

### /list

List players on a server

**Permission:** None · **Cooldown:** None · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `server` | String | Yes | Server to fetch players from — Choices: `1` |

---

### /lottery

Start or join a lottery

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `amount` | Number (min: 10) | Yes | Amount to enter with |

---

### /money

Check your current balance

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

*No options.*

---

### /pay

Send money to another player

**Permission:** None · **Cooldown:** 3s (user) · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `recipient` | User | Yes | The player to send money to |
| `amount` | Number (min: 0.001) | Yes | Amount to send (e.g., 10) |
| `note` | String | No | Optional note for the transfer |

---

### /ping

Check bot latency

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

*No options.*

---

### /playtime

Check playtime of a user

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | User | No | User to check the playtime for |

---

### /seen

Check when a player was last online

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | User | No | User to check |

---

### /skin

Display a player's Minecraft skin

**Permission:** None · **Cooldown:** 5s (user) · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | User | No | User to check |

---

### /status

Show game server status and online player counts

**Permission:** None · **Cooldown:** 10s (user) · **Env:** prod

*No options.*

---

### /username

Retrieve user's Minecraft username

**Permission:** Discord Administrator · **Cooldown:** None · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | User | Yes | User to retrieve username for |

---

## Public Commands

### /register

Register to Createrington

**Permission:** None · **Cooldown:** 60s (user) · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mc_name` | String | Yes | Your exact Minecraft username (case doesn't matter) |

---

### /verify

Verify your token from the email invitation

**Permission:** None · **Cooldown:** 60s (user) · **Env:** prod

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `token` | String | Yes | Your unique verification token |

---
