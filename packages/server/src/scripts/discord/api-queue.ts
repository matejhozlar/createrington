/**
 * Rate-limited queue for Discord API calls in scripts.
 *
 * Processes tasks sequentially with a configurable delay between each call
 * to avoid hitting Discord's rate limits. Logs progress and collects results.
 *
 * Usage:
 * ```ts
 * const queue = new DiscordApiQueue({ delayMs: 1200 });
 * queue.add("Set nickname for Player1", () => member.setNickname("Player1"));
 * queue.add("Set nickname for Player2", () => member.setNickname("Player2"));
 * const results = await queue.process();
 * ```
 */

interface QueueTask<T = unknown> {
  label: string;
  fn: () => Promise<T>;
}

interface QueueResult {
  label: string;
  success: boolean;
  error?: string;
}

interface DiscordApiQueueOptions {
  /** Delay in ms between each API call (default: 1200ms, safe for most Discord endpoints) */
  delayMs?: number;
}

export class DiscordApiQueue {
  private tasks: QueueTask[] = [];
  private delayMs: number;

  constructor(options: DiscordApiQueueOptions = {}) {
    this.delayMs = options.delayMs ?? 1200;
  }

  /** Add a task to the queue. */
  add(label: string, fn: () => Promise<unknown>): void {
    this.tasks.push({ label, fn });
  }

  /** Number of tasks in the queue. */
  get size(): number {
    return this.tasks.length;
  }

  /**
   * Process all queued tasks sequentially with rate-limit delays.
   * Returns results for each task (success/failure).
   */
  async process(): Promise<QueueResult[]> {
    const results: QueueResult[] = [];
    const total = this.tasks.length;

    for (let i = 0; i < total; i++) {
      const task = this.tasks[i];
      const progress = `[${i + 1}/${total}]`;

      try {
        await task.fn();
        results.push({ label: task.label, success: true });
        console.log(`  ${progress} ✓ ${task.label}`);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results.push({ label: task.label, success: false, error });
        console.log(`  ${progress} ✗ ${task.label}: ${error}`);
      }

      // Delay between calls (skip after the last one)
      if (i < total - 1) {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }
    }

    this.tasks = [];
    return results;
  }
}
