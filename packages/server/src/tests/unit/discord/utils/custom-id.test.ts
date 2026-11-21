import { describe, it, expect } from "vitest";
import { defineCustomId } from "@/discord/utils/custom-id";

describe("defineCustomId", () => {
  const ticket = defineCustomId("ticket", ["action", "target"]);
  const close = defineCustomId("registration:close");

  it("builds an id from the prefix and the fields in order", () => {
    expect(ticket.build({ action: "close", target: 42 })).toBe(
      "ticket:close:42",
    );
  });

  it("parses an id it built", () => {
    expect(ticket.parse(ticket.build({ action: "reopen", target: 7 }))).toEqual(
      { action: "reopen", target: "7" },
    );
  });

  it("does not match another prefix that only starts the same", () => {
    expect(ticket.matches("tickets:close:1")).toBe(false);
    expect(ticket.matches("ticket")).toBe(false);
  });

  it("rejects an id with missing or empty fields", () => {
    expect(ticket.parse("ticket:close")).toBeNull();
    expect(ticket.parse("ticket::1")).toBeNull();
    expect(ticket.parse("ticket:close:")).toBeNull();
  });

  it("keeps extra segments in the last field", () => {
    expect(ticket.parse("ticket:close:1:2")).toEqual({
      action: "close",
      target: "1:2",
    });
  });

  it("matches a field-less id exactly", () => {
    expect(close.build()).toBe("registration:close");
    expect(close.matches("registration:close")).toBe(true);
    expect(close.matches("registration:close:1")).toBe(false);
    expect(close.matches("registration:open")).toBe(false);
  });

  it("supports a prefix that contains the separator", () => {
    const respond = defineCustomId("prompt:respond", ["promptId"]);

    expect(respond.parse("prompt:respond:12")).toEqual({ promptId: "12" });
    expect(respond.matches("prompt:submit:12")).toBe(false);
  });
});
