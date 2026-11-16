import { vi } from "vitest";

export const modpackChangelogMock = () => ({
  announceReleaseChangelog: vi.fn(async () => undefined),
});
