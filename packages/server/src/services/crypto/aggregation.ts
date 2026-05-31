import { Q } from "@/db";
import { CRYPTO_CONFIG } from "./crypto.config";

/**
 * Rolls up tick-level snapshots into minute OHLCV candles and prunes old ticks.
 *
 * For each active token, gathers ticks from the last completed minute, computes
 * open/high/low/close/volume, and inserts a minute-interval snapshot. Duplicate
 * inserts are silently ignored (unique constraint). Old tick snapshots beyond the
 * configured retention window are deleted.
 */
export async function aggregateMinuteSnapshots(): Promise<void> {
  const tokens = await Q.crypto.token.getAll();
  const now = new Date();
  now.setSeconds(0, 0);

  // Look back 5 minutes (matching the aggregation interval) so that
  // slower-ticking tokens (stablecoins every 10min, blue-chips every 1h)
  // still produce minute snapshots from their ticks.
  const lookbackMinutes = 5;

  for (const token of tokens) {
    for (let m = lookbackMinutes; m >= 1; m--) {
      const bucketStart = new Date(now.getTime() - m * 60_000);
      const bucketEnd = new Date(bucketStart.getTime() + 60_000);

      const ticks = await Q.crypto.price.snapshot
        .where({
          tokenId: token.id,
          interval: "tick",
          recordedAt: { $gte: bucketStart, $lt: bucketEnd },
        })
        .orderBy("recordedAt", "asc")
        .all();

      if (ticks.length === 0) continue;

      const open = ticks[0].openPrice;
      const close = ticks[ticks.length - 1].closePrice;
      const high = ticks.reduce(
        (max, t) => (Number(t.highPrice) > Number(max) ? t.highPrice : max),
        ticks[0].highPrice,
      );
      const low = ticks.reduce(
        (min, t) => (Number(t.lowPrice) < Number(min) ? t.lowPrice : min),
        ticks[0].lowPrice,
      );
      const volume = ticks.reduce((sum, t) => sum + t.volume, 0n);

      try {
        await Q.crypto.price.snapshot.create({
          tokenId: token.id,
          interval: "minute",
          openPrice: open,
          highPrice: high,
          lowPrice: low,
          closePrice: close,
          volume,
          recordedAt: bucketStart,
        });
      } catch {
        // Ignore duplicate (unique constraint on token+interval+recordedAt)
      }
    }
  }

  const tickCutoff = new Date(Date.now() - CRYPTO_CONFIG.RETENTION.TICK * 1000);
  await Q.crypto.price.snapshot.deleteAll({
    interval: "tick",
    recordedAt: { $lt: tickCutoff },
  });
}

/**
 * Rolls up minute-level snapshots into hourly OHLCV candles and prunes old minute snapshots.
 */
export async function aggregateHourlySnapshots(): Promise<void> {
  const tokens = await Q.crypto.token.getAll();
  const now = new Date();

  const currentHourStart = new Date(now);
  currentHourStart.setMinutes(0, 0, 0);

  // The completed hour: [hourStart, currentHourStart)
  const hourStart = new Date(currentHourStart.getTime() - 3_600_000);

  for (const token of tokens) {
    const minutes = await Q.crypto.price.snapshot
      .where({
        tokenId: token.id,
        interval: "minute",
        recordedAt: { $gte: hourStart, $lt: currentHourStart },
      })
      .orderBy("recordedAt", "asc")
      .all();

    if (minutes.length === 0) continue;

    const open = minutes[0].openPrice;
    const close = minutes[minutes.length - 1].closePrice;
    const high = minutes.reduce(
      (max, s) => (Number(s.highPrice) > Number(max) ? s.highPrice : max),
      minutes[0].highPrice,
    );
    const low = minutes.reduce(
      (min, s) => (Number(s.lowPrice) < Number(min) ? s.lowPrice : min),
      minutes[0].lowPrice,
    );
    const volume = minutes.reduce((sum, s) => sum + s.volume, 0n);

    await Q.crypto.price.snapshot.upsert(
      {
        tokenId: token.id,
        interval: "hourly",
        openPrice: open,
        highPrice: high,
        lowPrice: low,
        closePrice: close,
        volume,
        recordedAt: hourStart,
      },
      ["tokenId", "interval", "recordedAt"],
    );
  }

  const minuteCutoff = new Date(
    Date.now() - CRYPTO_CONFIG.RETENTION.MINUTE * 1000,
  );
  await Q.crypto.price.snapshot.deleteAll({
    interval: "minute",
    recordedAt: { $lt: minuteCutoff },
  });
}

/**
 * Rolls up hourly snapshots into daily OHLCV candles and prunes old hourly snapshots.
 * Uses midnight-to-midnight UTC boundaries.
 */
export async function aggregateDailySnapshots(): Promise<void> {
  const tokens = await Q.crypto.token.getAll();
  const now = new Date();

  // Start of today UTC
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // The completed day: yesterday
  const dayStart = new Date(todayStart.getTime() - 86_400_000);

  for (const token of tokens) {
    const hourlySnaps = await Q.crypto.price.snapshot
      .where({
        tokenId: token.id,
        interval: "hourly",
        recordedAt: { $gte: dayStart, $lt: todayStart },
      })
      .orderBy("recordedAt", "asc")
      .all();

    if (hourlySnaps.length === 0) continue;

    const open = hourlySnaps[0].openPrice;
    const close = hourlySnaps[hourlySnaps.length - 1].closePrice;
    const high = hourlySnaps.reduce(
      (max, s) => (Number(s.highPrice) > Number(max) ? s.highPrice : max),
      hourlySnaps[0].highPrice,
    );
    const low = hourlySnaps.reduce(
      (min, s) => (Number(s.lowPrice) < Number(min) ? s.lowPrice : min),
      hourlySnaps[0].lowPrice,
    );
    const volume = hourlySnaps.reduce((sum, s) => sum + s.volume, 0n);

    await Q.crypto.price.snapshot.upsert(
      {
        tokenId: token.id,
        interval: "daily",
        openPrice: open,
        highPrice: high,
        lowPrice: low,
        closePrice: close,
        volume,
        recordedAt: dayStart,
      },
      ["tokenId", "interval", "recordedAt"],
    );
  }

  const hourlyCutoff = new Date(
    Date.now() - CRYPTO_CONFIG.RETENTION.HOURLY * 1000,
  );
  await Q.crypto.price.snapshot.deleteAll({
    interval: "hourly",
    recordedAt: { $lt: hourlyCutoff },
  });
}

/**
 * Rolls up daily snapshots into weekly OHLCV candles and prunes old daily snapshots.
 * Uses Monday-to-Sunday UTC boundaries.
 */
export async function aggregateWeeklySnapshots(): Promise<void> {
  const tokens = await Q.crypto.token.getAll();
  const now = new Date();

  // Find this Monday 00:00 UTC
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayOfWeek = todayStart.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(
    todayStart.getTime() - daysSinceMonday * 86_400_000,
  );
  // The completed week: [lastMonday, thisMonday)
  const lastMonday = new Date(thisMonday.getTime() - 7 * 86_400_000);

  for (const token of tokens) {
    const dailySnaps = await Q.crypto.price.snapshot
      .where({
        tokenId: token.id,
        interval: "daily",
        recordedAt: { $gte: lastMonday, $lt: thisMonday },
      })
      .orderBy("recordedAt", "asc")
      .all();

    if (dailySnaps.length === 0) continue;

    const open = dailySnaps[0].openPrice;
    const close = dailySnaps[dailySnaps.length - 1].closePrice;
    const high = dailySnaps.reduce(
      (max, s) => (Number(s.highPrice) > Number(max) ? s.highPrice : max),
      dailySnaps[0].highPrice,
    );
    const low = dailySnaps.reduce(
      (min, s) => (Number(s.lowPrice) < Number(min) ? s.lowPrice : min),
      dailySnaps[0].lowPrice,
    );
    const volume = dailySnaps.reduce((sum, s) => sum + s.volume, 0n);

    const existing = await Q.crypto.price.snapshot
      .where({
        tokenId: token.id,
        interval: "weekly",
        recordedAt: lastMonday,
      })
      .first();

    if (!existing) {
      await Q.crypto.price.snapshot.create({
        tokenId: token.id,
        interval: "weekly",
        openPrice: open,
        highPrice: high,
        lowPrice: low,
        closePrice: close,
        volume,
        recordedAt: lastMonday,
      });
    }
  }

  const dailyCutoff = new Date(
    Date.now() - CRYPTO_CONFIG.RETENTION.DAILY * 1000,
  );
  await Q.crypto.price.snapshot.deleteAll({
    interval: "daily",
    recordedAt: { $lt: dailyCutoff },
  });
}
