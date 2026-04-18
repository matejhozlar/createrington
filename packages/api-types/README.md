# @createrington/api-types

Typed tRPC router contracts exposed by the Createrington backend for
first-party consumer projects (admin panel, bots, future tools).

This package ships a single bundled `.d.ts` file — no runtime code, no
cross-package imports. All transitive types (context, metadata, auth
payloads) are inlined.

## Install

Add the scope registry to your project's `.npmrc` (package is hosted on
Gitea):

```
@createrington:registry=https://gitea.matejhoz.com/api/packages/Createrington/npm/
```

Then install:

```
pnpm add @createrington/api-types
```

## Usage

Import the router type for your consumer and use it with `@trpc/client`:

```ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { PanelRouter } from "@createrington/api-types";

const client = createTRPCClient<PanelRouter>({
  links: [
    httpBatchLink({
      url: "https://createrington.com/api/trpc/consumers.panel",
      headers: () => ({ authorization: `Bearer ${jwt}` }),
    }),
  ],
});

const { players } = await client.presence.onlineByServer.query({
  serverIdentifier: "cogs-test",
});
```

## Available router types

| Export        | Consumer    |
| ------------- | ----------- |
| `PanelRouter` | Admin panel |

New router types are added to this package as new first-party consumers
come online. Each router type is a semver-stable contract for its
consumer.

## Authentication

Every procedure on a consumer router reuses the backend's `adminProcedure`
— the caller must forward a valid Createrington admin JWT as
`Authorization: Bearer <token>`. The caller is expected to enforce any
additional authorization rules (e.g. per-server RBAC) before calling.

## Versioning

- **Minor bumps** — new procedures, new optional fields. Safe to upgrade.
- **Major bumps** — removed procedures, changed shapes, tightened inputs.
  Review carefully.
- **Patch bumps** — non-behavioural changes.

Versions are published automatically when the main Createrington app
deploys to production. The CHANGELOG at the repository root is the source
of truth for what changed in each version.

## License

UNLICENSED — see the repository root `LICENSE`. This package is intended
for use only by first-party Createrington projects authorised by the
copyright holder.
