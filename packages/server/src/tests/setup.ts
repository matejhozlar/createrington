import { beforeAll, afterAll } from "vitest";
import "@/logger.global";

beforeAll(() => {
  logger.info("Test suite stating...");
});

afterAll(() => {
  logger.info("Test suite finished");
});
