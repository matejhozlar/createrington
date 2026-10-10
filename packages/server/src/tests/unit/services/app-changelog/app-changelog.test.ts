import { describe, it, expect } from "vitest";
import { summarizeRelease } from "@/services/app-changelog";

const CHANGELOG = [
  "## v1.66.0 (2026-10-10)",
  "",
  "### @createrington/server (1.66.1 → 1.67.0)",
  "- [add] Add a `/ticket remove` admin subcommand",
  "- [fix] Fix closing a ticket only locking out its owner",
  "",
  "### @createrington/client (0.2.83 → 0.2.84)",
  "- [fix] Fix the team row overflowing",
  "- [security] Reject unsigned uploads",
  "- [polish] Tune the hover timing",
  "- Reword the empty state",
  "",
  "## v1.65.3 (2026-10-08)",
  "",
  "### @createrington/client (0.2.82 → 0.2.83)",
  "- [add] Add Saidai_V to the team page",
  "- [refactor] Rework the team page hover animations",
  "- [remove] Remove the team member dialog",
  "- [chore] Bump `createrington-skin-api`",
  "",
].join("\n");

describe("summarizeRelease", () => {
  it("counts the entries of the requested version across its packages", () => {
    expect(summarizeRelease(CHANGELOG, "1.66.0")).toEqual({
      date: "2026-10-10",
      counts: {
        add: 1,
        fix: 2,
        refactor: 0,
        remove: 0,
        security: 1,
        chore: 0,
        other: 2,
      },
    });
  });

  it("stops at the next version heading", () => {
    expect(summarizeRelease(CHANGELOG, "1.65.3")).toEqual({
      date: "2026-10-08",
      counts: {
        add: 1,
        fix: 0,
        refactor: 1,
        remove: 1,
        security: 0,
        chore: 1,
        other: 0,
      },
    });
  });

  it("returns null when the changelog has no section for the version", () => {
    expect(summarizeRelease(CHANGELOG, "1.66.1")).toBeNull();
    expect(summarizeRelease("", "1.66.0")).toBeNull();
  });

  it("does not match a version that only shares a prefix", () => {
    expect(summarizeRelease(CHANGELOG, "1.66")).toBeNull();
    expect(summarizeRelease(CHANGELOG, "1.65.30")).toBeNull();
  });

  it("reads a changelog with windows line endings", () => {
    const summary = summarizeRelease(
      CHANGELOG.replace(/\n/g, "\r\n"),
      "1.66.0",
    );
    expect(summary?.date).toBe("2026-10-10");
    expect(summary?.counts.fix).toBe(2);
  });
});
