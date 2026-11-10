import axios, { AxiosError } from "axios";
import { env } from "@/config/env/env.config";

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
  private readonly client = axios.create({ timeout: REQUEST_TIMEOUT_MS });

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
      const response = await this.client.post<{ sessionId: number }>(
        `${env.CLAUDE_API_URL}/api/triage`,
        request,
        { headers: this.headers() },
      );
      return { sessionId: response.data.sessionId };
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 429) {
        throw new IssueTriageError("busy");
      }
      throw new IssueTriageError("failed");
    }
  }

  /** Current state of a triage session. */
  async status(sessionId: number): Promise<IssueTriageStatus> {
    const response = await this.client.get<IssueTriageStatus>(
      `${env.CLAUDE_API_URL}/api/triage/${sessionId}`,
      { headers: this.headers() },
    );
    return response.data;
  }

  /** Polls until the session settles; resolves null if it is still running after `maxWaitMs`. */
  async waitForOutcome(
    sessionId: number,
    maxWaitMs = DEFAULT_WAIT_MS,
  ): Promise<IssueTriageStatus | null> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      try {
        const current = await this.status(sessionId);
        if (current.status === "completed" || current.status === "failed") {
          return current;
        }
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 404) {
          return null;
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
