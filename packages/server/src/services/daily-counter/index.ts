const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 90;

/** What the counter needs from Redis: whether it can be reached, and one raw command at a time. */
export interface CounterRedis {
  readonly isReady: boolean;
  sendCommand(args: string[]): Promise<unknown>;
}

export interface DailyCounts<Name extends string> {
  /** UTC day, `YYYY-MM-DD`. */
  date: string;
  counts: Record<Name, number>;
}

function utcDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function toCount(reply: unknown): number {
  const count = Number(reply ?? 0);
  return Number.isFinite(count) ? count : 0;
}

/**
 * Counts events per UTC day under a name, for numbers that are only looked
 * at. Counting never waits and never fails: an event is counted in memory
 * first and written to Redis in the background, so counts survive a restart
 * of the app once they are written. While Redis cannot be reached (or is not
 * configured) the counts wait in memory and are added to Redis when it is
 * back; a restart in between loses them. A day is kept for `retentionDays`.
 * A write Redis applied but did not confirm in time is written again, so a
 * count can come out slightly high after trouble with Redis, never low.
 */
export class DailyCounter<Name extends string> {
  private readonly unwritten = new Map<string, number>();
  private writing: Promise<void> | null = null;
  private addedWhileWriting = false;

  constructor(
    private readonly prefix: string,
    private readonly redis: CounterRedis,
    private readonly retentionDays = DEFAULT_RETENTION_DAYS,
  ) {}

  /** Counts `by` events of this name for today. Returns at once. */
  add(name: Name, by = 1): void {
    const key = this.key(name, utcDay(Date.now()));
    this.unwritten.set(key, (this.unwritten.get(key) ?? 0) + by);
    this.addedWhileWriting = true;
    void this.write();
  }

  /**
   * The counts of the names for each of the last `days` days, today first.
   * `stored` is false when Redis could not be read, so the counts are only
   * what this process counted and has not written yet.
   */
  async read(
    names: readonly Name[],
    days: number,
  ): Promise<{ stored: boolean; days: DailyCounts<Name>[] }> {
    const now = Date.now();
    const dates = Array.from({ length: days }, (_, index) =>
      utcDay(now - index * DAY_MS),
    );
    const keys = dates.flatMap((date) =>
      names.map((name) => this.key(name, date)),
    );

    const replies = await this.readStored(keys);
    return {
      stored: replies !== null,
      days: dates.map((date, dateIndex) => {
        const counts = {} as Record<Name, number>;
        names.forEach((name, nameIndex) => {
          const index = dateIndex * names.length + nameIndex;
          counts[name] =
            toCount(replies?.[index]) + (this.unwritten.get(keys[index]!) ?? 0);
        });
        return { date, counts };
      }),
    };
  }

  /** Resolves once every count that can be written now is written. */
  write(): Promise<void> {
    this.writing ??= this.writeUnwritten().finally(() => {
      this.writing = null;
    });
    return this.writing;
  }

  private async readStored(keys: string[]): Promise<unknown[] | null> {
    if (!this.redis.isReady || keys.length === 0) return null;
    try {
      const replies = await this.redis.sendCommand(["MGET", ...keys]);
      return Array.isArray(replies) ? replies : null;
    } catch {
      return null;
    }
  }

  private async writeUnwritten(): Promise<void> {
    do {
      this.addedWhileWriting = false;
      this.forgetOldDays();

      for (const [key, count] of [...this.unwritten]) {
        if (!this.redis.isReady) return;
        try {
          await this.redis.sendCommand(["INCRBY", key, `${count}`]);
        } catch {
          return;
        }

        const left = (this.unwritten.get(key) ?? 0) - count;
        if (left > 0) this.unwritten.set(key, left);
        else this.unwritten.delete(key);

        await this.redis
          .sendCommand(["PEXPIRE", key, `${this.retentionDays * DAY_MS}`])
          .catch(() => undefined);
      }
    } while (this.addedWhileWriting);
  }

  private forgetOldDays(): void {
    const oldest = utcDay(Date.now() - this.retentionDays * DAY_MS);
    for (const key of this.unwritten.keys()) {
      if (key.slice(-oldest.length) < oldest) this.unwritten.delete(key);
    }
  }

  private key(name: Name, date: string): string {
    return `${this.prefix}:${name}:${date}`;
  }
}
