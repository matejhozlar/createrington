import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import {
  ALL_SETTING_KEYS,
  SETTINGS_REGISTRY,
  type SettingKey,
} from "@/services/crypto";
import { trpcError, auditActor } from "@/trpc/utils";

const settingKeySchema = z.enum(
  ALL_SETTING_KEYS as [SettingKey, ...SettingKey[]],
);

function isKnownKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS_REGISTRY, key);
}

export const adminCryptoSettingsRouter = router({
  list: adminProcedure
    .meta({
      description: "List all runtime-tweakable crypto settings",
    })
    .query(async () => {
      const settings = await getService(Services.CRYPTO_SETTINGS_SERVICE);
      const rows = await Q.crypto.setting.getAll();
      const rowMap = new Map(rows.map((r) => [r.key, r]));

      return settings.list().map((entry) => {
        const row = isKnownKey(entry.key) ? rowMap.get(entry.key) : undefined;
        return {
          ...entry,
          updatedAt: row?.updatedAt.toISOString() ?? null,
          updatedByDiscordId: row?.updatedByDiscordId ?? null,
        };
      });
    }),

  update: adminProcedure
    .meta({ description: "Override a runtime crypto setting" })
    .input(
      z.object({
        key: settingKeySchema,
        value: z.unknown(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const settings = await getService(Services.CRYPTO_SETTINGS_SERVICE);
      let result;
      try {
        result = await settings.set(input.key, input.value, ctx.user.discordId);
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Setting update failed",
        );
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "crypto_setting_update",
        description: `Updated ${input.key}`,
        tableName: "crypto_setting",
        fieldName: input.key,
        oldValue: JSON.stringify(result.oldValue),
        newValue: JSON.stringify(result.newValue),
      });

      return {
        key: input.key,
        oldValue: result.oldValue,
        newValue: result.newValue,
      };
    }),

  reset: adminProcedure
    .meta({ description: "Reset a setting to its compiled default" })
    .input(z.object({ key: settingKeySchema }))
    .mutation(async ({ input, ctx }) => {
      const settings = await getService(Services.CRYPTO_SETTINGS_SERVICE);
      const result = await settings.reset(input.key, ctx.user.discordId);

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "crypto_setting_reset",
        description: `Reset ${input.key} to default`,
        tableName: "crypto_setting",
        fieldName: input.key,
        oldValue: JSON.stringify(result.oldValue),
        newValue: JSON.stringify(result.newValue),
      });

      return {
        key: input.key,
        oldValue: result.oldValue,
        newValue: result.newValue,
      };
    }),

  resetAll: adminProcedure
    .meta({ description: "Reset every overridden crypto setting" })
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const settings = await getService(Services.CRYPTO_SETTINGS_SERVICE);
      const cleared = await settings.resetAll(ctx.user.discordId);

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "crypto_setting_reset_all",
        description: `Reset ${cleared} crypto settings to defaults`,
        tableName: "crypto_setting",
      });

      return { cleared };
    }),
});
