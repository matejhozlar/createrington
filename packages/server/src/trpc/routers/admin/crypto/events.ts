import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import { auditActor } from "@/trpc/utils";
import type { MarketEventType } from "@/services/crypto/events/event-definitions";

export const cryptoEventProcedures = {
  triggerEvent: adminProcedure
    .meta({ description: "Manually trigger a market event" })
    .input(
      z.object({
        eventType: z.enum([
          "bull_run",
          "bear_market",
          "flash_crash",
          "pump_and_dump",
          "liquidity_drought",
          "gold_rush",
          "supply_shock",
          "tax_holiday",
          "whale_dump",
          "new_listing_frenzy",
        ]),
        tokenId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = await getService(Services.CRYPTO_MARKET_SERVICE);

      const event = await service.triggerEvent(
        input.eventType as MarketEventType,
        input.tokenId,
      );

      if (!event) {
        return {
          success: false,
          message: "Event could not be triggered (no valid target token found)",
        };
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "crypto_event_trigger",
        description: `Triggered ${input.eventType} event on ${event.tokenSymbol ?? "all tokens"}`,
        metadata: {
          eventType: input.eventType,
          tokenId: event.tokenId,
          tokenSymbol: event.tokenSymbol,
        },
      });

      return {
        success: true,
        event: {
          id: event.eventId,
          type: event.type,
          tokenId: event.tokenId,
          tokenSymbol: event.tokenSymbol,
          activeUntil: event.activeUntil?.toISOString() ?? null,
        },
      };
    }),

  activeEvents: adminProcedure
    .meta({ description: "List currently active market events" })
    .query(async () => {
      const service = await getService(Services.CRYPTO_MARKET_SERVICE);

      const events = service.getActiveEvents();
      return events.map((e) => ({
        id: e.eventId,
        type: e.type,
        tokenId: e.tokenId,
        tokenSymbol: e.tokenSymbol,
        activeUntil: e.activeUntil?.toISOString() ?? null,
        effects: e.effects,
      }));
    }),
};
