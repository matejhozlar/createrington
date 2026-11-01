import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export interface VotifierVote {
  serviceName: string;
  username: string;
  timestamp: Date | null;
}

export type FrameResult =
  | { status: "incomplete" }
  | { status: "unsupported" }
  | { status: "complete"; body: string };

export type VerifyResult =
  { ok: true; vote: VotifierVote } | { ok: false; error: string };

const MAGIC_HIGH = 0x73;
const MAGIC_LOW = 0x3a;
const HEADER_LENGTH = 4;
const EPOCH_MILLIS_THRESHOLD = 100_000_000_000;

export function createChallenge(): string {
  return randomUUID();
}

export function greeting(challenge: string): string {
  return `VOTIFIER 2 ${challenge}\n`;
}

export function readFrame(buffer: Buffer): FrameResult {
  if (buffer.length < 2) {
    return { status: "incomplete" };
  }
  if (buffer[0] !== MAGIC_HIGH || buffer[1] !== MAGIC_LOW) {
    return { status: "unsupported" };
  }
  if (buffer.length < HEADER_LENGTH) {
    return { status: "incomplete" };
  }
  const length = buffer.readUInt16BE(2);
  if (buffer.length < HEADER_LENGTH + length) {
    return { status: "incomplete" };
  }
  return {
    status: "complete",
    body: buffer
      .subarray(HEADER_LENGTH, HEADER_LENGTH + length)
      .toString("utf8"),
  };
}

export function verifyFrame(
  body: string,
  token: string,
  challenge: string,
): VerifyResult {
  const envelope = parseJson(body);
  if (
    !isRecord(envelope) ||
    typeof envelope.payload !== "string" ||
    typeof envelope.signature !== "string"
  ) {
    return { ok: false, error: "malformed message" };
  }

  if (!signatureMatches(envelope.payload, envelope.signature, token)) {
    return { ok: false, error: "signature verification failed" };
  }

  const payload = parseJson(envelope.payload);
  if (!isRecord(payload)) {
    return { ok: false, error: "malformed payload" };
  }
  if (payload.challenge !== challenge) {
    return { ok: false, error: "challenge verification failed" };
  }
  if (
    typeof payload.serviceName !== "string" ||
    typeof payload.username !== "string"
  ) {
    return { ok: false, error: "malformed payload" };
  }

  return {
    ok: true,
    vote: {
      serviceName: payload.serviceName,
      username: payload.username,
      timestamp: parseTimestamp(payload.timestamp),
    },
  };
}

export function encodeResponse(status: "ok" | "error", error?: string): string {
  return `${JSON.stringify(error ? { status, error } : { status })}\r\n`;
}

export function encodeVoteFrame(
  vote: { serviceName: string; username: string; timestamp?: number | string },
  token: string,
  challenge: string,
): Buffer {
  const payload = JSON.stringify({ ...vote, challenge });
  const signature = createHmac("sha256", token)
    .update(payload)
    .digest("base64");
  const body = Buffer.from(JSON.stringify({ payload, signature }), "utf8");
  const header = Buffer.from([
    MAGIC_HIGH,
    MAGIC_LOW,
    (body.length >> 8) & 0xff,
    body.length & 0xff,
  ]);
  return Buffer.concat([header, body]);
}

function signatureMatches(
  payload: string,
  signature: string,
  token: string,
): boolean {
  const expected = createHmac("sha256", token).update(payload).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function parseTimestamp(value: unknown): Date | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  const millis = numeric < EPOCH_MILLIS_THRESHOLD ? numeric * 1000 : numeric;
  return new Date(millis);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
