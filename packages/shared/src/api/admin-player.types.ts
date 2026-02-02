// packages/shared/src/api/admin-player.types.ts

/**
 * Admin Player API Response Types
 *
 * Type definitions for admin player management endpoints
 */
import type {
  PlayerApiData,
  PlayerBalanceApiData,
  PlayerBalanceTransactionApiData,
  PlayerPlaytimeSummaryApiData,
  PlayerSessionApiData,
  TicketApiData,
  WaitlistEntryApiData,
  PlayerStrikeApiData,
} from "../db";
import { DateToString } from "../types";

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Path parameters for admin player endpoints
 */
export interface AdminPlayerPathParams {
  id: string; // Discord ID or Minecraft UUID
}

/**
 * Query parameters for GET /api/admin/players
 */
export interface GetAdminPlayersQuery {
  // Filtering
  discordId?: string;
  minecraftUuid?: string;
  minecraftUsername?: string;
  online?: "true" | "false";

  // Pagination
  page?: string;
  limit?: string;

  // Sorting
  sortBy?: "createdAt" | "minecraftUsername" | "updatedAt" | "lastSeen";
  sortOrder?: "asc" | "desc";
}

/**
 * Body for PATCH /api/admin/players/:id
 */
export interface UpdateAdminPlayerBody {
  minecraftUsername?: string;
  discordId?: string;
  reason: string;
}

/**
 * Body for DELETE /api/admin/players/:id
 */
export interface DeleteAdminPlayerBody {
  reason: string;
}

/**
 * Query parameters for GET /api/admin/players/:id/balance
 */
export interface GetPlayerBalanceQuery {
  limit?: string; // Number of recent transactions (default: 10, max: 100)
}

/**
 * Body for POST /api/admin/players/:id/balance/adjust
 */
export interface AdjustPlayerBalanceBody {
  amount: number; // Positive to add, negative to subtract
  reason: string;
}

/**
 * Query parameters for GET /api/admin/players/:id/audit-log
 */
export interface GetPlayerAuditLogQuery {
  limit?: string; // Number of actions (default: 50, max: 200)
}

/**
 * Query parameters for GET /api/admin/players/:id/sessions
 */
export interface GetPlayerSessionsQuery {
  serverId?: string;
  page?: string;
  limit?: string; // Number of sessions (default: 50, max: 200)
}

/**
 * Body for POST /api/admin/players/bulk/balance
 */
export interface BulkBalanceAdjustBody {
  playerUuids: string[];
  amount: number;
  reason: string;
}

/**
 * Query parameters for GET /api/admin/players/:id/strikes
 */
export interface GetPlayerStrikesQuery {
  /** Filter to only active (non-removed) strikes */
  activeOnly?: "true" | "false";
}

/**
 * Body for POST /api/admin/players/:id/strikes
 */
export interface IssueStrikeBody {
  /** Classification category of the strike */
  classification: StrikeClassification;
  /** Detailed description of the violation */
  description: string;
  /** Severity level from 1 (minor) to 5 (severe) */
  severity: 1 | 2 | 3 | 4 | 5;
  /** Optional server ID where the violation occurred */
  serverId?: number;
  /** Additional metadata (coordinates, evidence links, item IDs, etc.) */
  metadata?: Record<string, any>;
}

/**
 * Body for DELETE /api/admin/players/:id/strikes/:strikeId
 */
export interface RemoveStrikeBody {
  /** Reason for removing/pardoning the strike */
  reason: string;
}

// ============================================================================
// RESPONSE DATA TYPES
// ============================================================================

/**
 * Strike classification categories
 */
export type StrikeClassification =
  | "pvp"
  | "theft"
  | "griefing"
  | "laggy_machines"
  | "inappropriate_chat"
  | "harassment"
  | "exploiting"
  | "rule_violation"
  | "other";

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
  /** Total number of strikes (active + removed) */
  total: number;
  /** Number of active (non-removed) strikes */
  active: number;
  /** Number of removed/pardoned strikes */
  removed: number;
  /** Breakdown by classification type */
  byClassification: Record<StrikeClassification, number>;
  /** Breakdown by severity level */
  bySeverity: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Timestamp of the most recent strike (ISO 8601) */
  mostRecent?: string;
}

/**
 * Strike data for admin view
 */
export interface AdminPlayerStrikes {
  /** All strikes (including removed) */
  all: DateToString<PlayerStrikeApiData>[];
  /** Active (non-removed) strikes only */
  active: DateToString<PlayerStrikeApiData>[];
  /** Count of active strikes */
  activeCount: number;
  /** Total count of all strikes */
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
// RESPONSE TYPES
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
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
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
    actions: AdminActionLog[];
    total: number;
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
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Response for GET /api/admin/players/:id/tickets
 */
export interface GetPlayerTicketsResponse {
  success: true;
  data: {
    tickets: TicketApiData[];
    total: number;
  };
}

/**
 * Response for GET /api/admin/players/:id/strikes
 */
export interface GetPlayerStrikesResponse {
  success: true;
  data: {
    /** List of strikes (filtered by activeOnly if specified) */
    strikes: DateToString<PlayerStrikeApiData>[];
    /** Statistical breakdown of all strikes */
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
