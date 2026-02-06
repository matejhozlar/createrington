import type { Request, Response } from "express";
import {
  GetPlaytimeHoursQuerySchema,
  type GetPlaytimeHoursBreakdownResponse,
  type GetPlaytimeHoursResponse,
} from "@createrington/shared/api/public/metrics";
import { metricsService } from "@/services/metrics";
import z from "zod";
import { BadRequestError, InternalServerError } from "@/app/middleware";

/**
 * Playtime Metrics Controller
 *
 * Handles all playtime-related metric endpoints
 */
export class PlaytimeMetricsController {
  /**
   * GET /api/metrics/playtime/hours
   *
   * Get total hours played
   *
   * Query Parameters:
   * - serverId?: number - Optional server filter (omit for all servers)
   *
   * Examples:
   * - GET /api/metrics/playtime/hours → All servers
   * - GET /api/metrics/playtime/hours?serverId=1 → Server 1 only
   *
   * @throws {BadRequestError} Invalid query parameters
   * @throws {InternalServerError} Database or service error
   */
  static async getTotalHours(req: Request, res: Response): Promise<void> {
    try {
      const { serverId } = GetPlaytimeHoursQuerySchema.parse(req.query);

      const totalHours = await metricsService.playtime.getTotalHours(serverId);

      const response: GetPlaytimeHoursResponse = {
        success: true,
        data: {
          serverId: serverId ?? null,
          totalHours,
        },
      };

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BadRequestError(
          error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", "),
        );
      }

      logger.error("Failed to fetch playtime hours:", error);
      throw new InternalServerError("Failed to fetch playtime hours");
    }
  }

  /**
   * GET /api/metrics/playtime/hours/breakdown
   *
   * Get hours breakdown by server
   *
   * Returns total hours for each server plus global total
   *
   * Example:
   * - GET /api/metrics/playtime/hours/breakdown
   *
   * @throws {InternalServerError} Database or service error
   */
  static async getHoursBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const breakdown = await metricsService.playtime.getTotalHoursBreakdown();

      const response: GetPlaytimeHoursBreakdownResponse = {
        success: true,
        data: breakdown,
      };

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BadRequestError(
          error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", "),
        );
      }

      logger.error("Failed to fetch playtime hours breakdown:", error);
      throw new InternalServerError("Failed to fetch playtime hours breakdown");
    }
  }
}
