/**
 * A single participant in a lottery round
 */
export interface LotteryParticipant {
  minecraftUuid: string;
  minecraftUsername: string;
  /** Amount the player bet (used as weight for winner selection) */
  amount: number;
}

/**
 * In-memory state of a currently running lottery
 */
export interface ActiveLottery {
  startedBy: LotteryParticipant;
  participants: LotteryParticipant[];
  totalPot: number;
  startedAt: Date;
  /** True until the host's start transaction commits; joins are rejected while set */
  pending: boolean;
  /** Timer handle for automatic resolution; null until the host's start transaction commits */
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Result returned after successfully starting a lottery
 */
export interface LotteryStartResult {
  success: boolean;
  message: string;
  entryAmount: number;
  endsAt: Date;
}

/**
 * Result returned after a player joins a lottery
 */
export interface LotteryJoinResult {
  success: boolean;
  message: string;
  entryAmount: number;
  totalPot: number;
  participantCount: number;
}

/**
 * Public info snapshot of the active lottery
 */
export interface LotteryInfo {
  totalPot: number;
  participantCount: number;
  startedAt: Date;
  endsAt: Date;
  participants: LotteryParticipant[];
}
