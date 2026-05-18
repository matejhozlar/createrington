import crypto from "node:crypto";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";

const TTL_SECONDS = 5 * 60;

export function signDevLoginToken(
  token: string,
  secret: string,
  timestampSec: number = Math.floor(Date.now() / 1000),
): { ts: number; sig: string } {
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${token}.${timestampSec}`)
    .digest("hex");
  return { ts: timestampSec, sig };
}

export function verifyDevLoginToken(
  token: string,
  ts: number,
  sig: string,
  secret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > TTL_SECONDS) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${token}.${ts}`)
    .digest("hex");
  return timingSafeEqualStrings(expected, sig);
}
