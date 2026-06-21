import type { LotteryParticipant } from "./types";

/**
 * Picks a lottery winner with probability proportional to each participant's
 * bet amount. Draws a point in [0, totalWeight) and walks the participants,
 * subtracting each weight until the point is consumed.
 */
export function pickWeightedWinner(
  participants: LotteryParticipant[],
): LotteryParticipant {
  const totalWeight = participants.reduce((sum, p) => sum + p.amount, 0);
  let random = Math.random() * totalWeight;

  for (const participant of participants) {
    random -= participant.amount;
    if (random <= 0) {
      return participant;
    }
  }

  // Fallback (should not happen)
  return participants[participants.length - 1];
}
