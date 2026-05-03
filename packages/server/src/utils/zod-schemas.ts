import { z } from "zod";

/**
 * Loose UUID matcher (8-4-4-4-12 hex). Accepts any value Postgres `uuid`
 * accepts, including non-RFC-4122 sentinels used elsewhere in the stack —
 * e.g. opac-fakeplayer's `00000000-0000-0000-0000-000000000001`. Use this
 * over `z.string().uuid()` for any input sourced from Minecraft/mod data.
 */
export const MC_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const mcUuid = z.string().regex(MC_UUID_REGEX, "Invalid Minecraft UUID");
