import config from "@/config";
import { describeHttpError, fetchJson, HttpStatusError } from "@/utils/http";

const REQUEST_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 5_000;
const DEFAULT_WAIT_MS = 12 * 60 * 1000;

export type AutomationStartFailure = "not_configured" | "busy" | "failed";

export class AutomationStartError extends Error {
  constructor(readonly kind: AutomationStartFailure) {
    super(`claude-automation session ${kind}`);
  }
}

export interface AutomationSessionStatus {
  status: "queued" | "active" | "completed" | "failed";
  result: string | null;
}

/**
 * HTTP client for one kind of claude-automation session that is started with
 * a request and polled until it settles (`POST /api/<path>`, then
 * `GET /api/<path>/<id>`). Stateless; requires `config.adminChat`
 * (CLAUDE_API_URL and ADMIN_CHAT_SECRET).
 */
export class AutomationSessionClient<
  TRequest,
  TStatus extends AutomationSessionStatus,
> {
  constructor(
    private readonly path: string,
    private readonly label: string,
    private readonly orphaned: TStatus,
  ) {}

  /** Whether the app is configured to reach claude-automation. */
  isConfigured(): boolean {
    return Boolean(config.adminChat.url && config.adminChat.secret);
  }

  /** Starts a session; throws AutomationStartError on refusal or failure. */
  async start(request: TRequest): Promise<{ sessionId: number }> {
    if (!this.isConfigured()) {
      throw new AutomationStartError("not_configured");
    }
    try {
      const response = await fetchJson<{ sessionId: number }>(this.url(), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return { sessionId: response.sessionId };
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 429) {
        throw new AutomationStartError("busy");
      }
      throw new AutomationStartError("failed");
    }
  }

  /** Current state of a session. */
  async status(sessionId: number): Promise<TStatus> {
    return fetchJson<TStatus>(this.url(sessionId), {
      headers: this.headers(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  /**
   * Polls until the session settles. A session claude-automation no longer
   * knows settles as failed with result "orphaned"; resolves null if it is
   * still running after `maxWaitMs`.
   */
  async waitForOutcome(
    sessionId: number,
    maxWaitMs = DEFAULT_WAIT_MS,
  ): Promise<TStatus | null> {
    const deadline = Date.now() + maxWaitMs;
    let pollErrorLogged = false;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      try {
        const current = await this.status(sessionId);
        if (current.status === "completed" || current.status === "failed") {
          return current;
        }
      } catch (error) {
        if (error instanceof HttpStatusError && error.status === 404) {
          return this.orphaned;
        }
        if (!pollErrorLogged) {
          pollErrorLogged = true;
          logger.warn(
            `${this.label} session #${sessionId} status poll failed:`,
            describeHttpError(error),
          );
        }
      }
    }
    return null;
  }

  private url(sessionId?: number): string {
    const base = `${config.adminChat.url}/api/${this.path}`;
    return sessionId === undefined ? base : `${base}/${sessionId}`;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Admin-Chat-Secret": config.adminChat.secret ?? "",
    };
  }
}
