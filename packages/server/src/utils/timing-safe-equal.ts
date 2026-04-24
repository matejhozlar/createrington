import { Buffer } from "node:buffer";
import crypto from "node:crypto";

/** Constant-time string comparison for shared secrets. */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
