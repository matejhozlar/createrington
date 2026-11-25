import { router, adminProcedure } from "@/trpc/trpc";
import { signTackToken } from "@/services/tack";
import config from "@/config";

export const adminOverlayRouter = router({
  get: adminProcedure
    .meta({
      description:
        "Where the tack comment widget loads from for admins: its loader, global, mask attribute and project; null while tack is not configured",
    })
    .query(() => {
      const tack = config.tack;
      if (!tack) return null;
      return {
        scriptUrl: `${tack.url}${tack.loaderPath}`,
        apiUrl: tack.url,
        globalName: tack.globalName,
        maskAttribute: tack.maskAttribute,
        project: tack.project,
      };
    }),
  token: router({
    get: adminProcedure
      .meta({
        description:
          "A short-lived tack host token for the signed-in admin, asked for only once the widget is open; null while tack is not configured",
      })
      .query(({ ctx }) => {
        const tack = config.tack;
        if (!tack) return null;
        return signTackToken(ctx.user, tack);
      }),
  }),
});
