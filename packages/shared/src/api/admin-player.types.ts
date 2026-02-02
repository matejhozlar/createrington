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
} from "../db";

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

// ============================================================================
// RESPONSE DATA TYPES
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
  summary: PlayerPlaytimeSummaryApiData[];
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
 * Detailed player data for admin panel
 */
export interface AdminPlayerDetailed {
  player: PlayerApiData;
  balance: PlayerBalanceApiData | null;
  playtime: AdminPlayerPlaytime;
  tickets: AdminPlayerTickets;
  waitlist: WaitlistEntryApiData | null;
}

/**
 * Balance information with recent transactions
 */
export interface PlayerBalanceInfo {
  balance: PlayerBalanceApiData;
  formattedBalance: string;
  recentTransactions: PlayerBalanceTransactionApiData[];
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
    total: number;
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
