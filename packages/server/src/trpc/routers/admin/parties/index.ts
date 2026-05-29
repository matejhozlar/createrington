import { router } from "@/trpc/trpc";
import { partyProcedures } from "./parties";
import { chunkProcedures } from "./chunks";

/** Admin parties router: forceload/ally party views plus server_chunk aggregates. */
export const adminPartiesRouter = router({
  ...partyProcedures,
  ...chunkProcedures,
});
