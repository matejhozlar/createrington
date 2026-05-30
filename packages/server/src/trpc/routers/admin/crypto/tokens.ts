import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import { MEMECOIN_CATALOG } from "@/services/crypto/memecoin/catalog";
import { trpcError, auditActor } from "@/trpc/utils";

function serializeToken<
  T extends { totalSupply: bigint; availableSupply: bigint },
>(token: T) {
  return {
    ...token,
    totalSupply: String(token.totalSupply),
    availableSupply: String(token.availableSupply),
  };
}

export const cryptoTokenProcedures = {
  availableMemecoins: adminProcedure
    .meta({
      description: "List memecoin catalog entries not already in the DB",
    })
    .query(async () => {
      const existing = await Q.crypto.token.where({}).all();
      const usedSymbols = new Set(existing.map((t) => t.symbol));
      return MEMECOIN_CATALOG.filter((m) => !usedSymbols.has(m.symbol));
    }),

  createToken: adminProcedure
    .meta({ description: "Create a new memecoin or seasonal token" })
    .input(
      z.object({
        name: z.string().min(1).max(50),
        symbol: z
          .string()
          .min(1)
          .max(10)
          .transform((s) => s.toUpperCase()),
        description: z.string().max(500).optional(),
        category: z.enum(["memecoin", "seasonal"]),
        totalSupply: z.number().int().positive(),
        price: z.number().positive(),
        floorPrice: z.number().positive().optional(),
        delistedAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.category === "memecoin") {
        const catalogEntry = MEMECOIN_CATALOG.find(
          (m) => m.symbol === input.symbol,
        );
        if (!catalogEntry) {
          throw trpcError.badRequest(
            `Symbol ${input.symbol} is not in the memecoin catalog`,
          );
        }
      }

      const service = await getService(Services.CRYPTO_MARKET_SERVICE);

      const token = await service.createToken({
        name: input.name,
        symbol: input.symbol,
        description: input.description,
        category: input.category,
        totalSupply: BigInt(input.totalSupply),
        price: input.price.toFixed(8),
        floorPrice: input.floorPrice?.toFixed(8),
        delistedAt: input.delistedAt ? new Date(input.delistedAt) : undefined,
      });

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "crypto_token_create",
        description: `Created token ${input.symbol} (${input.name})`,
        metadata: {
          tokenId: token.id,
          symbol: input.symbol,
          category: input.category,
          price: input.price,
        },
      });

      return { token: serializeToken(token) };
    }),

  updateToken: adminProcedure
    .meta({ description: "Update token properties" })
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(500).optional(),
        floorPrice: z.number().positive().nullable().optional(),
        delistedAt: z.string().datetime().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      const oldToken = await Q.crypto.token.get({ id });

      // Build update payload explicitly so that null values (clearing a field)
      // are forwarded, while truly absent fields are omitted entirely.
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined)
        updateData.description = updates.description;
      if (updates.floorPrice !== undefined)
        updateData.floorPrice = updates.floorPrice?.toFixed(8) ?? null;
      if (updates.delistedAt !== undefined)
        updateData.delistedAt = updates.delistedAt
          ? new Date(updates.delistedAt)
          : null;

      await Q.crypto.token.update({ id }, updateData);
      const token = await Q.crypto.token.get({ id });

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "crypto_token_update",
        description: `Updated token ${oldToken.symbol}`,
        metadata: { tokenId: id, symbol: oldToken.symbol, changes: updates },
      });

      return { token: serializeToken(token) };
    }),

  delistToken: adminProcedure
    .meta({
      description:
        "Delist a token: auto-sells all holdings at current price and marks as delisted",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const token = await Q.crypto.token.get({ id: input.id });
      const service = await getService(Services.CRYPTO_MARKET_SERVICE);

      await service.delistToken(input.id);

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "crypto_token_delist",
        description: `Delisted token ${token.symbol} (${token.name})`,
        metadata: { tokenId: input.id, symbol: token.symbol },
      });

      return { message: "Token delisted successfully" };
    }),
};
