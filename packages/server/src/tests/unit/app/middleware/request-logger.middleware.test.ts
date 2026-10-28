import { describe, it, expect } from "vitest";
import { redactUrl } from "@/app/middleware/request-logger.middleware";

describe("redactUrl", () => {
  it("leaves a url without a query untouched", () => {
    expect(redactUrl("/api/auth/me")).toBe("/api/auth/me");
  });

  it("redacts the OAuth code and state of the SSO callback", () => {
    expect(redactUrl("/api/auth/sso/callback?code=abc123&state=xyz")).toBe(
      "/api/auth/sso/callback?code=[REDACTED]&state=[REDACTED]",
    );
  });

  it("redacts the dev refresh token and signature but keeps the other params", () => {
    expect(
      redactUrl(
        "/api/auth/dev-set-refresh?token=t0k&ts=1700000000&sig=s1g&return_to=%2F",
      ),
    ).toBe(
      "/api/auth/dev-set-refresh?token=[REDACTED]&ts=1700000000&sig=[REDACTED]&return_to=%2F",
    );
  });

  it("matches keys regardless of case or percent-encoding", () => {
    expect(redactUrl("/x?CODE=a&%74oken=b&page=2")).toBe(
      "/x?CODE=[REDACTED]&%74oken=[REDACTED]&page=2",
    );
  });

  it("redacts a repeated key every time it appears", () => {
    expect(redactUrl("/x?code=a&code=b")).toBe(
      "/x?code=[REDACTED]&code=[REDACTED]",
    );
  });
});
