import { describe, it, expect } from "vitest";
import { readTicketMetadata } from "@/services/discord/tickets/types";

describe("readTicketMetadata", () => {
  it("reads the stored close message and transcript path", () => {
    expect(
      readTicketMetadata({
        closeMessageId: "123",
        transcriptPath: "/data/transcripts/ticket-1.html",
      }),
    ).toEqual({
      closeMessageId: "123",
      transcriptPath: "/data/transcripts/ticket-1.html",
    });
  });

  it("treats missing metadata as empty", () => {
    expect(readTicketMetadata(null)).toEqual({});
    expect(readTicketMetadata(undefined)).toEqual({});
  });

  it("drops a malformed field and keeps the valid one", () => {
    expect(
      readTicketMetadata({ closeMessageId: 42, transcriptPath: "/t.html" }),
    ).toEqual({ closeMessageId: undefined, transcriptPath: "/t.html" });
  });

  it("treats an empty string as missing", () => {
    expect(readTicketMetadata({ transcriptPath: "" }).transcriptPath).toBe(
      undefined,
    );
  });

  it("treats a non-object as empty", () => {
    expect(readTicketMetadata("broken")).toEqual({});
  });
});
