import { env } from "@/config/env/env.config";
import { describeHttpError, fetchJson, HttpStatusError } from "@/utils/http";

const REQUEST_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 5_000;
const DEFAULT_WAIT_MS = 12 * 60 * 1000;

export interface IssueTriageRequest {
  transcript: string;
  messageCount: number;
  requestedBy: string;
  sourceLabel: string;
  sourceUrl?: string;
  note?: string;
}

export interface IssueTriageIssue {
  repo: string;
  number: number;
  title: string;
  url: string;
}

export interface IssueTriageStatus {
  status: "queued" | "active" | "completed" | "failed";
  result: string | null;
  issue: IssueTriageIssue | null;
  reason: string | null;
}

export type IssueTriageStartError = "not_configured" | "busy" | "failed";

export class IssueTriageError extends Error {
  constructor(readonly kind: IssueTriageStartError) {
    super(`Issue triage ${kind}`);
  }
}

/**
 * Client for claude-automation's Discord issue triage sessions. A session
 * reads a channel transcript, picks the Createrington repository the problem
 * belongs to, checks for duplicates and files the issue. Stateless; requires
 * CLAUDE_API_URL and ADMIN_CHAT_SECRET.
 */
export class IssueTriageService {
  /** Whether the app is configured to reach claude-automation. */
  isConfigured(): boolean {
    return Boolean(env.CLAUDE_API_URL && env.ADMIN_CHAT_SECRET);
  }

  /** Starts a triage session; throws IssueTriageError on refusal or failure. */
  async start(request: IssueTriageRequest): Promise<{ sessionId: number }> {
    if (!this.isConfigured()) {
      throw new IssueTriageError("not_configured");
    }
    try {
      const response = await fetchJson<{ sessionId: number }>(
        `${env.CLAUDE_API_URL}/api/triage`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      return { sessionId: response.sessionId };
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 429) {
        throw new IssueTriageError("busy");
      }
      throw new IssueTriageError("failed");
    }
  }

  /** Current state of a triage session. */
  async status(sessionId: number): Promise<IssueTriageStatus> {
    return fetchJson<IssueTriageStatus>(
      `${env.CLAUDE_API_URL}/api/triage/${sessionId}`,
      {
        headers: this.headers(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  }

  /**
   * Polls until the session settles. A session claude-automation no longer
   * knows settles as failed with result "orphaned"; resolves null if it is
   * still running after `maxWaitMs`.
   */
  async waitForOutcome(
    sessionId: number,
    maxWaitMs = DEFAULT_WAIT_MS,
  ): Promise<IssueTriageStatus | null> {
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
          return {
            status: "failed",
            result: "orphaned",
            issue: null,
            reason: null,
          };
        }
        if (!pollErrorLogged) {
          pollErrorLogged = true;
          logger.warn(
            `Issue triage session #${sessionId} status poll failed:`,
            describeHttpError(error),
          );
        }
      }
    }
    return null;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Admin-Chat-Secret": env.ADMIN_CHAT_SECRET ?? "",
    };
  }
}

export const issueTriageService = new IssueTriageService();
