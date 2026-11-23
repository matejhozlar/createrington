import { z } from "zod";
import { STAT_CATEGORY_LABELS } from "@createrington/shared/minecraft-stats";

function requiredParam(message: string) {
  return z.string({ error: message }).min(1, message);
}

export const CompareQuerySchema = z.object({
  player1: requiredParam("player1 and player2 query params required"),
  player2: requiredParam("player1 and player2 query params required"),
});

export const PlayerQuerySchema = z.object({
  player: requiredParam("player query param required"),
});

export const TopQuerySchema = z.object({
  category: requiredParam("category and item query params required").refine(
    (category) => Object.hasOwn(STAT_CATEGORY_LABELS, category),
    "Invalid stat category",
  ),
  item: requiredParam("category and item query params required"),
});

export const DesignQuerySchema = z.object({
  design: requiredParam("design query param required"),
});

export type CompareQuery = z.infer<typeof CompareQuerySchema>;
export type PlayerQuery = z.infer<typeof PlayerQuerySchema>;
export type TopQuery = z.infer<typeof TopQuerySchema>;
export type DesignQuery = z.infer<typeof DesignQuerySchema>;
