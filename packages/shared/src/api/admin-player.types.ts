/**
 * Admin Player API Types
 *
 * Request schemas (Zod for validation) and response types for admin player management endpoints
 */
import { z } from "zod";
import type {
  PlayerApiData,
  PlayerBalanceApiData,
  PlayerBalanceTransactionApiData,
  PlayerPlaytimeSummaryApiData,
  PlayerSessionApiData,
  TicketApiData,
  WaitlistEntryApiData,
  PlayerStrikeApiData,
  StrikeClassification,
  AdminLogActionApiData,
} from "../db";
import type { DateToString } from "../types";
import type { PaginationMeta } from "./common";

// ============================================================================
// REQUEST SCHEMAS (Zod - Validates User Input)
// ============================================================================

/**
 * Query parameters for GET /api/admin/players
 */
export const GetAdminPlayersQuerySchema = z.object({
  // Filtering
  discordId: z.string().optional(),
  minecraftUuid: z.string().optional(),
  minecraftUsername: z.string().optional(),
  online: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),

  // Pagination
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // Sorting
  orderBy: z
    .enum(["createdAt", "minecraftUsername", "updatedAt", "lastSeen"])
    .default("createdAt"),
  orderDirection: z.enum(["asc", "desc"]).default("desc"),

  includeStrikeCounts: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true")
    .optional(),
});

/**
 * Body for PATCH /api/admin/players/:id
 */
export const UpdateAdminPlayerBodySchema = z.object({
  minecraftUsername: z.string().optional(),
  discordId: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
});

/**
 * Body for DELETE /api/admin/players/:id
 */
export const DeleteAdminPlayerBodySchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

/**
 * Query parameters for GET /api/admin/players/:id/balance
 */
export const GetPlayerBalanceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * Body for POST /api/admin/players/:id/balance/adjust
 */
export const AdjustPlayerBalanceBodySchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1, "Reason is required"),
});

/**
 * Query parameters for GET /api/admin/players/:id/audit-log
 */
export const GetPlayerAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * Query parameters for GET /api/admin/players/:id/sessions
 */
export const GetPlayerSessionsQuerySchema = z.object({
  serverId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * Query parameters for GET /api/admin/players/:id/tickets
 */
export const GetPlayerTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Query parameters for GET /api/admin/players/:id/strikes
 */
export const GetPlayerStrikesQuerySchema = z.object({
  activeOnly: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

/**
 * Body for POST /api/admin/players/:id/strikes
 */
export const IssueStrikeBodySchema = z.object({
  /** Classification category - replace with actual values from StrikeClassification */
  classification: z.enum([
    "pvp",
    "theft",
    "griefing",
    "laggy_machines",
    "inappropriate_chat",
    "harassment",
    "exploiting",
    "rule_violation",
    "other",
  ]),
  description: z.string().min(1, "Description is required"),
  severity: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  serverId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Path parameters for DELETE /api/admin/players/:id/strikes/:strikeId
 */
export const RemoveStrikeParamsSchema = z.object({
  id: z.string().min(1, "Player ID is required"),
  strikeId: z.coerce.number().int().positive(),
});

/**
 * Body for DELETE /api/admin/players/:id/strikes/:strikeId
 */
export const RemoveStrikeBodySchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

/**
 * Body for POST /api/admin/players/bulk/balance
 */
export const BulkBalanceAdjustBodySchema = z.object({
  playerUuids: z
    .array(z.string().min(1))
    .min(1, "At least one player UUID is required"),
  amount: z.number().int(),
  reason: z.string().min(1, "Reason is required"),
});

// ============================================================================
// REQUEST TYPES (Auto-Inferred from Schemas)
// ============================================================================

export type GetAdminPlayersQuery = z.infer<typeof GetAdminPlayersQuerySchema>;
export type UpdateAdminPlayerBody = z.infer<typeof UpdateAdminPlayerBodySchema>;
export type DeleteAdminPlayerBody = z.infer<typeof DeleteAdminPlayerBodySchema>;
export type GetPlayerBalanceQuery = z.infer<typeof GetPlayerBalanceQuerySchema>;
export type AdjustPlayerBalanceBody = z.infer<
  typeof AdjustPlayerBalanceBodySchema
>;
export type GetPlayerAuditLogQuery = z.infer<
  typeof GetPlayerAuditLogQuerySchema
>;
export type GetPlayerSessionsQuery = z.infer<
  typeof GetPlayerSessionsQuerySchema
>;
export type GetPlayerTicketsQuery = z.infer<typeof GetPlayerTicketsQuerySchema>;
export type GetPlayerStrikesQuery = z.infer<typeof GetPlayerStrikesQuerySchema>;
export type IssueStrikeBody = z.infer<typeof IssueStrikeBodySchema>;
export type RemoveStrikeParams = z.infer<typeof RemoveStrikeParamsSchema>;
export type RemoveStrikeBody = z.infer<typeof RemoveStrikeBodySchema>;
export type BulkBalanceAdjustBody = z.infer<typeof BulkBalanceAdjustBodySchema>;

// ============================================================================
// RESPONSE DATA TYPES (Plain TypeScript - No Validation Needed)
// ============================================================================

/**
 * Admin action audit log entry
 */
export interface AdminActionLog {
  id: number;
  adminDiscordUsername: string;
  actionType: string;
  tableName: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  performedAt: string; // ISO 8601
  metadata: Record<string, any> | null;
}

/**
 * Playtime data for admin view
 */
export interface AdminPlayerPlaytime {
  summary: Array<
    DateToString<
      Omit<
        PlayerPlaytimeSummaryApiData,
        "totalSeconds" | "avgSessionSeconds"
      > & {
        totalSeconds: string;
        avgSessionSeconds: string;
      }
    >
  >;
  totalSeconds: number;
  totalSessions: number;
}

/**
 * Tickets data for admin view
 */
export interface AdminPlayerTickets {
  total: number;
  open: number;
}

/**
 * Strike statistics for a player
 */
export interface StrikeStatistics {
  total: number;
  active: number;
  removed: number;
  byClassification: Record<StrikeClassification, number>;
  bySeverity: Record<1 | 2 | 3 | 4 | 5, number>;
  mostRecent?: string;
}

/**
 * Strike data for admin view
 */
export interface AdminPlayerStrikes {
  all: DateToString<PlayerStrikeApiData>[];
  active: DateToString<PlayerStrikeApiData>[];
  activeCount: number;
  totalCount: number;
}

/**
 * Detailed player data for admin panel
 */
export interface AdminPlayerDetailed {
  player: DateToString<PlayerApiData>;
  balance: DateToString<
    Omit<PlayerBalanceApiData, "balance"> & {
      balance: string;
    }
  > | null;
  playtime: AdminPlayerPlaytime;
  tickets: AdminPlayerTickets;
  waitlist: DateToString<WaitlistEntryApiData> | null;
  strikes: AdminPlayerStrikes;
}

/**
 * Balance information with recent transactions
 */
export interface PlayerBalanceInfo {
  balance: DateToString<
    Omit<PlayerBalanceApiData, "balance"> & {
      balance: string;
    }
  >;
  formattedBalance: string;
  recentTransactions: Array<
    DateToString<
      Omit<
        PlayerBalanceTransactionApiData,
        "amount" | "balanceBefore" | "balanceAfter"
      > & {
        amount: string;
        balanceBefore: string;
        balanceAfter: string;
      }
    >
  >;
}

/**
 * Bulk balance adjustment result for a single player
 */
export interface BulkBalanceAdjustResult {
  playerUuid: string;
  playerUsername: string;
  success: boolean;
  newBalance?: number;
  error?: string;
}

/**
 * Summary of bulk balance adjustment operation
 */
export interface BulkBalanceAdjustSummary {
  total: number;
  successful: number;
  failed: number;
}

/**
 * Player statistics for admin dashboard
 */
export interface AdminPlayerStats {
  total: number;
  online: number;
  registered: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  balance: {
    total: string;
    average: string;
    median: string;
  };
}

// ============================================================================
// RESPONSE TYPES (Plain TypeScript - No Validation Needed)
// ============================================================================

/**
 * Response for GET /api/admin/players/:id
 */
export interface GetAdminPlayerResponse {
  success: true;
  data: AdminPlayerDetailed;
}

/**
 * Response for GET /api/admin/players
 */
export interface GetAdminPlayersResponse {
  success: true;
  data: {
    players: PlayerApiData[];
    pagination: PaginationMeta;
  };
}

/**
 * Response for PATCH /api/admin/players/:id
 */
export interface UpdateAdminPlayerResponse {
  success: true;
  data: {
    player: PlayerApiData;
  };
  message: string;
}

/**
 * Response for DELETE /api/admin/players/:id
 */
export interface DeleteAdminPlayerResponse {
  success: true;
  message: string;
}

/**
 * Response for GET /api/admin/players/:id/balance
 */
export interface GetPlayerBalanceResponse {
  success: true;
  data: PlayerBalanceInfo;
}

/**
 * Response for POST /api/admin/players/:id/balance/adjust
 */
export interface AdjustPlayerBalanceResponse {
  success: true;
  data: {
    newBalance: number;
    adjustment: number;
  };
  message: string;
}

/**
 * Response for GET /api/admin/players/:id/audit-log
 */
export interface GetPlayerAuditLogResponse {
  success: true;
  data: {
    actions: AdminLogActionApiData[];
    pagination: PaginationMeta;
  };
}

/**
 * Response for GET /api/admin/players/:id/playtime
 */
export interface GetPlayerPlaytimeResponse {
  success: true;
  data: AdminPlayerPlaytime;
}

/**
 * Response for GET /api/admin/players/:id/sessions
 */
export interface GetPlayerSessionsResponse {
  success: true;
  data: {
    sessions: PlayerSessionApiData[];
    pagination: PaginationMeta;
  };
}

/**
 * Response for GET /api/admin/players/:id/tickets
 */
export interface GetPlayerTicketsResponse {
  success: true;
  data: {
    tickets: TicketApiData[];
    pagination: PaginationMeta;
  };
}

/**
 * Response for GET /api/admin/players/:id/strikes
 */
export interface GetPlayerStrikesResponse {
  success: true;
  data: {
    strikes: DateToString<PlayerStrikeApiData>[];
    statistics: StrikeStatistics;
  };
}

/**
 * Response for POST /api/admin/players/:id/strikes
 */
export interface IssueStrikeResponse {
  success: true;
  data: {
    strike: DateToString<PlayerStrikeApiData>;
  };
  message: string;
}

/**
 * Response for DELETE /api/admin/players/:id/strikes/:strikeId
 */
export interface RemoveStrikeResponse {
  success: true;
  data: {
    strike: DateToString<PlayerStrikeApiData>;
  };
  message: string;
}

/**
 * Response for GET /api/admin/players/stats
 */
export interface GetAdminPlayerStatsResponse {
  success: true;
  data: AdminPlayerStats;
}

/**
 * Response for POST /api/admin/players/bulk/balance
 */
export interface BulkBalanceAdjustResponse {
  success: true;
  data: {
    results: BulkBalanceAdjustResult[];
    summary: BulkBalanceAdjustSummary;
  };
  message: string;
}

/**
 * Error response for admin player endpoints
 */
export interface AdminPlayerErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
  };
}
