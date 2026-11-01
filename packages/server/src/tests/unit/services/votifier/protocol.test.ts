import { describe, it, expect } from "vitest";
import {
  encodeResponse,
  encodeVoteFrame,
  greeting,
  readFrame,
  verifyFrame,
} from "@/services/votifier/protocol";

const TOKEN = "unit-test-token-with-enough-length";
const CHALLENGE = "6d2d9d2e-2a6f-4b4e-9b1e-000000000001";
const VOTE = { serviceName: "createmodservers.com", username: "Agent772" };

function body(frame: Buffer): string {
  const read = readFrame(frame);
  if (read.status !== "complete") throw new Error(read.status);
  return read.body;
}

describe("greeting", () => {
  it("announces protocol 2 with the challenge and a newline", () => {
    expect(greeting(CHALLENGE)).toBe(`VOTIFIER 2 ${CHALLENGE}\n`);
  });
});

describe("readFrame", () => {
  it("waits for the magic bytes", () => {
    expect(readFrame(Buffer.alloc(0))).toEqual({ status: "incomplete" });
    expect(readFrame(Buffer.from([0x73]))).toEqual({ status: "incomplete" });
  });

  it("reports anything but the v2 magic as unsupported", () => {
    expect(readFrame(Buffer.from([0x12, 0x34, 0x56]))).toEqual({
      status: "unsupported",
    });
  });

  it("waits until the length-prefixed body has fully arrived", () => {
    const frame = encodeVoteFrame(VOTE, TOKEN, CHALLENGE);

    expect(readFrame(frame.subarray(0, 3))).toEqual({ status: "incomplete" });
    expect(readFrame(frame.subarray(0, frame.length - 1))).toEqual({
      status: "incomplete",
    });
    expect(readFrame(frame).status).toBe("complete");
  });

  it("ignores bytes after the declared length", () => {
    const frame = encodeVoteFrame(VOTE, TOKEN, CHALLENGE);
    const padded = Buffer.concat([frame, Buffer.from("trailing")]);

    expect(body(padded)).toBe(body(frame));
  });
});

describe("verifyFrame", () => {
  it("accepts a vote signed with the token for the issued challenge", () => {
    const frame = encodeVoteFrame(
      { ...VOTE, timestamp: 1788984909 },
      TOKEN,
      CHALLENGE,
    );

    expect(verifyFrame(body(frame), TOKEN, CHALLENGE)).toEqual({
      ok: true,
      vote: {
        serviceName: VOTE.serviceName,
        username: VOTE.username,
        timestamp: new Date(1788984909 * 1000),
      },
    });
  });

  it("reads millisecond and string timestamps and tolerates a missing one", () => {
    const millis = 1788984909123;
    const asMillis = encodeVoteFrame(
      { ...VOTE, timestamp: millis },
      TOKEN,
      CHALLENGE,
    );
    const asString = encodeVoteFrame(
      { ...VOTE, timestamp: "1788984909" },
      TOKEN,
      CHALLENGE,
    );
    const missing = encodeVoteFrame(VOTE, TOKEN, CHALLENGE);

    expect(verifyFrame(body(asMillis), TOKEN, CHALLENGE)).toMatchObject({
      vote: { timestamp: new Date(millis) },
    });
    expect(verifyFrame(body(asString), TOKEN, CHALLENGE)).toMatchObject({
      vote: { timestamp: new Date(1788984909 * 1000) },
    });
    expect(verifyFrame(body(missing), TOKEN, CHALLENGE)).toMatchObject({
      vote: { timestamp: null },
    });
  });

  it("rejects a vote signed with another token", () => {
    const frame = encodeVoteFrame(
      VOTE,
      "some-other-token-of-length",
      CHALLENGE,
    );

    expect(verifyFrame(body(frame), TOKEN, CHALLENGE)).toEqual({
      ok: false,
      error: "signature verification failed",
    });
  });

  it("rejects a replay carrying a challenge from another connection", () => {
    const frame = encodeVoteFrame(VOTE, TOKEN, "stale-challenge");

    expect(verifyFrame(body(frame), TOKEN, CHALLENGE)).toEqual({
      ok: false,
      error: "challenge verification failed",
    });
  });

  it("rejects a body that is not the signed envelope", () => {
    expect(verifyFrame("not json", TOKEN, CHALLENGE)).toEqual({
      ok: false,
      error: "malformed message",
    });
    expect(
      verifyFrame(JSON.stringify({ payload: 1 }), TOKEN, CHALLENGE),
    ).toEqual({ ok: false, error: "malformed message" });
  });

  it("rejects a signed payload without a username", () => {
    const frame = encodeVoteFrame(
      { serviceName: VOTE.serviceName, username: undefined as never },
      TOKEN,
      CHALLENGE,
    );

    expect(verifyFrame(body(frame), TOKEN, CHALLENGE)).toEqual({
      ok: false,
      error: "malformed payload",
    });
  });
});

describe("encodeResponse", () => {
  it("writes the status line the sender waits for", () => {
    expect(encodeResponse("ok")).toBe('{"status":"ok"}\r\n');
    expect(encodeResponse("error", "nope")).toBe(
      '{"status":"error","error":"nope"}\r\n',
    );
  });
});
