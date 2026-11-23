# @createrington/client

React 19 + Vite single-page app for the Createrington portal, served on port
3000 in development. Vite proxies `/api`, `/trpc`, and `/socket.io` to the server
on port 5001.

```bash
pnpm dev:client        # from the repository root
pnpm typecheck:client
pnpm lint:client
```

| Path               | Contents                                                        |
| ------------------ | --------------------------------------------------------------- |
| `src/features/`    | Every routed page and feature area (home, admin, chat...)       |
| `src/components/`  | Shared components, including the Shadcn/ui primitives           |
| `src/contexts/`    | Auth, WebSocket, server data, player data, admin, admin chat    |
| `src/hooks/`       | Shared hooks (toasts, mutation toasts, clipboard, countdown...) |
| `src/lib/`         | tRPC client and query client (`trpc.ts`), shared utilities      |
| `src/services/`    | REST client (`ky`) and the auth token manager                   |
| `src/maintenance/` | Standalone maintenance page, built by its own Vite config       |
| `src/tests/`       | Vitest unit tests (`pnpm test:unit`)                            |

Data comes from the server over tRPC + React Query, with the router type imported
type-only from `@createrington/server/trpc`. Styling is Tailwind CSS v4 on an
OkLCH dark palette.

See the [root README](../../README.md) and
[CONTRIBUTING.md](../../CONTRIBUTING.md) for setup and conventions.
