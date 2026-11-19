import { describe, it, expect, vi } from "vitest";

vi.mock("@/config", () => ({
  default: { sync: { secret: null }, internal: { secret: null } },
}));

import { requireHeaderSecret } from "@/app/middleware/header-secret.middleware";
import { UnauthorizedError } from "@/errors";
import { fakeReq, fakeRes } from "@/tests/helpers/http";

const SECRET = "s".repeat(32);

function check(
  headers: Record<string, unknown>,
  secret: string | null = SECRET,
): unknown[] {
  const calls: unknown[] = [];
  const middleware = requireHeaderSecret(
    "x-test-secret",
    () => secret,
    "test secret",
  );
  void middleware(
    fakeReq({ headers, baseUrl: "/api/test", path: "/" }),
    fakeRes(),
    (error?: unknown) => calls.push(error),
  );
  return calls;
}

describe("requireHeaderSecret", () => {
  it("lets a request with the matching header through", () => {
    expect(check({ "x-test-secret": SECRET })).toEqual([undefined]);
  });

  it("rejects a missing or wrong header", () => {
    for (const headers of [
      {},
      { "x-test-secret": "nope" },
      { "x-test-secret": [SECRET] },
    ]) {
      const [error] = check(headers);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect((error as Error).message).toBe("Invalid test secret");
    }
  });

  it("rejects every request while the secret is unset", () => {
    expect(check({ "x-test-secret": "" }, null)[0]).toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
