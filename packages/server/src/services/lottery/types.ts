export interface LotteryParticipant {
  minecraftUuid: string;
  minecraftUsername: string;
  amount: number;
}

export interface ActiveLottery {
  startedBy: LotteryParticipant;
  participants: LotteryParticipant[];
  totalPot: number;
  startedAt: Date;
  timer: ReturnType<typeof setTimeout>;
}

export interface LotteryStartResult {
  success: boolean;
  message: string;
  entryAmount: number;
  endsAt: Date;
}

export interface LotteryJoinResult {
  success: boolean;
  message: string;
  entryAmount: number;
  totalPot: number;
  participantCount: number;
}

export interface LotteryInfo {
  totalPot: number;
  participantCount: number;
  startedAt: Date;
  endsAt: Date;
  participants: LotteryParticipant[];
}
