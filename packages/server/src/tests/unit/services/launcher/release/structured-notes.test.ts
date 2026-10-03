import { describe, it, expect } from "vitest";
import { parseStructuredNotes } from "@/services/launcher/release/structured-notes";

const NOTES = {
  summary: "Faster start",
  changes: [
    {
      type: "improved",
      title: "Start time",
      description: "The launcher opens in half the time.",
    },
  ],
};

describe("parseStructuredNotes", () => {
  it("returns well-formed notes", () => {
    expect(parseStructuredNotes(NOTES)).toEqual(NOTES);
  });

  it("accepts notes without any change", () => {
    expect(
      parseStructuredNotes({ summary: "Small fixes", changes: [] }),
    ).toEqual({ summary: "Small fixes", changes: [] });
  });

  it.each([
    ["nothing stored", null],
    ["a plain text value", "Faster start"],
    ["a list instead of an entry", [NOTES]],
    ["an entry without a summary", { changes: NOTES.changes }],
    ["an entry without changes", { summary: "Faster start" }],
    [
      "a change without a title",
      {
        summary: "Faster start",
        changes: [{ type: "fixed", description: "x" }],
      },
    ],
  ])("returns null for %s", (_label, value) => {
    expect(parseStructuredNotes(value)).toBeNull();
  });
});
