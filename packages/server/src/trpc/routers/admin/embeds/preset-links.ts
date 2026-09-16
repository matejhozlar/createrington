import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { findOrThrow } from "@/trpc/utils";

export const embedPresetLinksRouter = router({
  list: adminProcedure
    .meta({ description: "List linked messages for a preset" })
    .input(z.object({ presetId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const links = await Q.discord.embed.preset.message
        .where({ presetId: input.presetId })
        .orderBy("createdAt", "desc")
        .all();
      return { links };
    }),

  delete: adminProcedure
    .meta({ description: "Unlink a message from a preset" })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await findOrThrow(
        Q.discord.embed.preset.message.find({ id: input.id }),
        "Link not found",
      );

      await Q.discord.embed.preset.message.delete({ id: input.id });

      return { message: "Link removed" };
    }),
});
