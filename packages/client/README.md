# @createrington/client

React 19 + Vite single-page app for the Createrington portal, served on port
3000 in development. Vite proxies `/api`, `/trpc`, and `/socket.io` to the server
on port 5001.

```bash
pnpm dev:client        # from the repository root
pnpm typecheck:client
pnpm lint:client
```

| Path              | Contents                                                   |
| ----------------- | ---------------------------------------------------------- |
| `src/features/`   | Feature areas (crypto, workshop, admin, donate, ...)       |
| `src/pages/`      | Top-level routed pages                                     |
| `src/components/` | Shared components, including the Shadcn/ui primitives      |
| `src/contexts/`   | Auth, WebSocket, server data, player data, toast providers |
| `src/services/`   | tRPC client, REST client (`ky`), token manager             |

Data comes from the server over tRPC + React Query, with the router type imported
type-only from `@createrington/server/trpc`. Styling is Tailwind CSS v4 on an
OkLCH dark palette.

See the [root README](../../README.md) and
[CONTRIBUTING.md](../../CONTRIBUTING.md) for setup and conventions.
