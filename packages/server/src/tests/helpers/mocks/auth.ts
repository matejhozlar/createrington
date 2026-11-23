import { vi } from "vitest";

export const authMocks = {
  accessCookie: () => ({
    accessCookieService: {
      isEnabled: () => false,
      extractFromRequest: () => undefined,
    },
  }),
  adminStatus: () => ({
    adminStatusService: { isAdmin: vi.fn(async () => false) },
  }),
};
