export enum CooldownType {
  USER = "user",
}

interface CooldownEntry {
  expiresAt: number;
  userId: string;
}

export interface CooldownStats {
  totalCooldowns: number;
  totalCommands: number;
  byCommand: Record<string, number>;
}

export class CooldownManager {
  private cooldowns = new Map<string, Map<string, CooldownEntry>>();

  private getKey(commandName: string, userId: string): string {
    return `${commandName}:user:${userId}`;
  }

  public getExpiry(commandName: string, userId: string): number | null {
    const entry = this.cooldowns
      .get(commandName)
      ?.get(this.getKey(commandName, userId));
    if (!entry) return null;

    if (Date.now() >= entry.expiresAt) return null;

    return entry.expiresAt;
  }

  public check(commandName: string, userId: string): number | null {
    const key = this.getKey(commandName, userId);
    const timestamps = this.cooldowns.get(commandName);
    const entry = timestamps?.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now < entry.expiresAt) {
      return Math.ceil((entry.expiresAt - now) / 1000);
    }

    timestamps?.delete(key);
    return null;
  }

  public set(
    commandName: string,
    userId: string,
    durationSeconds: number,
  ): void {
    const key = this.getKey(commandName, userId);

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }

    const entry: CooldownEntry = {
      expiresAt: Date.now() + durationSeconds * 1000,
      userId,
    };

    this.cooldowns.get(commandName)!.set(key, entry);

    setTimeout(() => {
      const timestamps = this.cooldowns.get(commandName);
      if (timestamps?.get(key) !== entry) return;

      timestamps.delete(key);

      if (timestamps.size === 0) {
        this.cooldowns.delete(commandName);
      }
    }, durationSeconds * 1000);
  }

  public resetCommand(commandName: string): boolean {
    return this.cooldowns.delete(commandName);
  }

  public resetUser(userId: string): number {
    let count = 0;

    this.cooldowns.forEach((timestamps, commandName) => {
      timestamps.forEach((entry, key) => {
        if (entry.userId === userId) {
          timestamps.delete(key);
          count++;
        }
      });

      if (timestamps.size === 0) {
        this.cooldowns.delete(commandName);
      }
    });

    return count;
  }

  public getStats(): CooldownStats {
    let totalCooldowns = 0;
    const byCommand: Record<string, number> = {};

    this.cooldowns.forEach((timestamps, commandName) => {
      totalCooldowns += timestamps.size;
      byCommand[commandName] = timestamps.size;
    });

    return {
      totalCooldowns,
      totalCommands: this.cooldowns.size,
      byCommand,
    };
  }
}

export const cooldownManager = new CooldownManager();
