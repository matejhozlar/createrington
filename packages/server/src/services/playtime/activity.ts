import { Q } from "@/db";
import { calendarDay } from "@/db/utils";
import type { Player } from "@/generated/db";

const ACTIVITY_WINDOW_DAYS = 365;

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function currentStreak(days: Record<string, number>): number {
  const check = new Date();
  if (!days[calendarDay(check)]) check.setDate(check.getDate() - 1);
  let streak = 0;
  while (days[calendarDay(check)]) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function mostActiveWeekday(days: Record<string, number>): string | null {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const [date, seconds] of Object.entries(days)) {
    const weekday = new Date(date).getUTCDay();
    totals[weekday] += seconds;
    counts[weekday]++;
  }
  let best: number | null = null;
  let bestAverage = 0;
  for (let weekday = 0; weekday < 7; weekday++) {
    const average = counts[weekday] > 0 ? totals[weekday] / counts[weekday] : 0;
    if (average > bestAverage) {
      bestAverage = average;
      best = weekday;
    }
  }
  return best === null ? null : WEEKDAY_NAMES[best];
}

export interface PlayerActivity {
  online: boolean;
  currentSessionSeconds: number | null;
  totalSeconds: number;
  currentStreak: number;
  mostActiveDay: string | null;
  days: Record<string, number>;
}

export async function getPlayerActivity(
  player: Pick<Player, "minecraftUuid" | "online">,
): Promise<PlayerActivity> {
  const { minecraftUuid } = player;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - ACTIVITY_WINDOW_DAYS);

  const [days, totalSeconds, activeSession] = await Promise.all([
    Q.player.playtime.daily.getPlayerDailyTotals(
      minecraftUuid,
      calendarDay(startDate),
    ),
    Q.player.playtime.summary.getPlayerTotalSeconds(minecraftUuid),
    player.online
      ? Q.player.session
          .where({
            playerMinecraftUuid: minecraftUuid,
            sessionEnd: { $exists: false },
          })
          .orderBy("sessionStart", "desc")
          .first()
      : null,
  ]);

  return {
    online: player.online,
    currentSessionSeconds: activeSession
      ? Math.floor((Date.now() - activeSession.sessionStart.getTime()) / 1000)
      : null,
    totalSeconds,
    currentStreak: currentStreak(days),
    mostActiveDay: mostActiveWeekday(days),
    days,
  };
}
