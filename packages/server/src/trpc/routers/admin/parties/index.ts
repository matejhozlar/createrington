import { router } from "@/trpc/trpc";
import { partyProcedures } from "./parties";
import { chunkProcedures } from "./chunks";

export const adminPartiesRouter = router({
  ...partyProcedures,
  ...chunkProcedures,
});
