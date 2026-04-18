/**
 * Public type contract for consumer tRPC routers exposed by @createrington/server.
 *
 * Consumers (panel, bots, etc.) install this package and use the exported
 * router types with `@trpc/client`'s `createTRPCClient<T>()`.
 */

export type { PanelRouter } from "@createrington/server/trpc/panel";
