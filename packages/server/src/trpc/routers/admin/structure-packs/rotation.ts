import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { paginationInput, buildPagination, auditActor } from "@/trpc/utils";
import { getRotationService } from "./helpers";

const rotationConfigRouter = router({
  get: adminProcedure
    .meta({ description: "Get rotation schedule config" })
    .query(async () => {
      const service = await getRotationService();
      return service.getConfig();
    }),

  update: adminProcedure
    .meta({ description: "Update rotation schedule config" })
    .input(
      z.object({
        period: z.enum(["daily", "weekly", "monthly"]).optional(),
        dayOfWeek: z.number().int().min(0).max(6).optional(),
        dayOfMonth: z.number().int().min(1).max(28).optional(),
        time: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
          .optional(),
        timezone: z.string().min(1).optional(),
        boostUnitPrice: z.number().int().positive().optional(),
        timeWeightMultiplier: z.number().positive().optional(),
        boostWeightPerUnit: z.number().min(0).optional(),
        gracePeriodMinutes: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = await getRotationService();
      const config = await service.updateConfig(input);
      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "structure_pack_config_update",
        description: "Updated structure pack rotation config",
        metadata: input,
      });
      return config;
    }),
});

export const structurePackRotationProcedures = {
  forceRotation: adminProcedure
    .meta({ description: "Trigger a manual rotation" })
    .mutation(async ({ ctx }) => {
      const service = await getRotationService();
      await service.executeRotation(true);
      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "structure_pack_force_rotation",
        description: "Triggered manual structure pack rotation",
      });
      return { triggered: true };
    }),

  clearRotation: adminProcedure
    .meta({ description: "Clear the current rotation and remove active mods" })
    .mutation(async ({ ctx }) => {
      const service = await getRotationService();
      await service.clearRotation();
      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "structure_pack_clear_rotation",
        description: "Cleared active structure pack rotation",
      });
      return { cleared: true };
    }),

  rotationHistory: adminProcedure
    .meta({ description: "Get paginated rotation history" })
    .input(z.object({ ...paginationInput() }))
    .query(async ({ input }) => {
      const service = await getRotationService();
      const { rows, total } = await service.getRotationHistory(
        input.limit,
        input.page * input.limit,
      );
      return {
        data: rows,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  rotationConfig: rotationConfigRouter,
};
