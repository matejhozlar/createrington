import {
  AutomationSessionClient,
  type AutomationSessionStatus,
} from "@/services/claude-automation/session-client";

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

export interface IssueTriageStatus extends AutomationSessionStatus {
  issue: IssueTriageIssue | null;
  reason: string | null;
}

/**
 * Client for claude-automation's Discord issue triage sessions. A session
 * reads a channel transcript, picks the Createrington repository the problem
 * belongs to, checks for duplicates and files the issue.
 */
export class IssueTriageService extends AutomationSessionClient<
  IssueTriageRequest,
  IssueTriageStatus
> {
  constructor() {
    super("triage", "Issue triage", {
      status: "failed",
      result: "orphaned",
      issue: null,
      reason: null,
    });
  }
}

export const issueTriageService = new IssueTriageService();
