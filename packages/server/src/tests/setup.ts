import { vi } from "vitest";
import { silentLogger } from "@/tests/helpers/silent-logger";

vi.mock("@/logger.global", async () => ({
  default: (await import("@/tests/helpers/silent-logger")).silentLogger,
}));

globalThis.logger = silentLogger;
