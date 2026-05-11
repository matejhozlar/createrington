# @createrington/server

Backend server for the Createrington platform - a Minecraft community management system integrating Discord, web dashboards, and game servers into a unified experience.

Built with Express 5, tRPC v11, PostgreSQL, Discord.js, and Socket.io.

## Overview

The server acts as the central hub connecting Minecraft game servers, Discord communities, and a web-based admin panel. It handles player registration, playtime tracking, in-game economy, ticket support, waitlist management, and real-time status broadcasting.

## Features

- **Dual API Layer** - tRPC for typed client queries and REST for auth flows and external integrations
- **Discord Bots** - Two bot instances (main + web) handling slash commands, button interactions, role management, and message caching
- **Real-Time Updates** - Socket.io server broadcasting live server status, player activity, and Discord messages
- **Player Management** - Registration, bans, strikes, balance/economy, session tracking, and audit logging
- **Playtime Tracking** - Per-server playtime monitoring with hourly/daily/summary aggregation
- **Ticket System** - Support ticket creation and management via Discord and web
- **Waitlist System** - Managed entry queues for game servers
- **Leaderboard System** - Automated leaderboard generation and updates
- **Role Management** - Automatic Discord role assignment based on playtime and other criteria
- **Email Notifications** - Transactional emails via Nodemailer
- **Comprehensive Logging** - Daily-rotated log files with automatic 7-day cleanup

## Discord Integration

### Main Bot

Handles all user-facing interactions:

- **Slash Commands** - `/register`, `/playtime`, `/leaderboard`, `/daily`, `/pay`, `/money`, `/ticket`, `/ping`, and admin commands
- **Button Interactions** - Registration flows, server selection, ticket management, waitlist, leaderboard navigation
- **Events** - Auto-role on member join, leave notifications

### Web Bot

Handles background operations: message caching, status rotation, and auxiliary tasks.

### Supporting Services

- **MessageCacheService** - Persists Discord messages to the database
- **TicketService** - Discord-based ticket support system
- **LeaderboardService** - Automated leaderboard generation
- **RoleManagementService** - Automatic role assignment based on playtime
- **MemberCleanupService** - Cleans up data for departed members
- **RotatingStatusService** - Cycles bot status messages
