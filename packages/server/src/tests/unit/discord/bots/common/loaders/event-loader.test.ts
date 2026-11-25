import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Client } from "discord.js";

const envMode = vi.hoisted(() => ({
  isDev: false,
  isProductionDeployment: false,
}));

vi.mock("@/config", () => ({ default: { envMode } }));

import { loadEventHandlers } from "@/discord/bots/common/loaders/event-loader";

let eventsDir: string;

beforeAll(() => {
  eventsDir = fs.mkdtempSync(path.join(os.tmpdir(), "event-loader-"));
  fs.writeFileSync(
    path.join(eventsDir, "everywhere.js"),
    'exports.eventName = "messageCreate";\nexports.execute = () => {};\n',
  );
  fs.writeFileSync(
    path.join(eventsDir, "production-only.js"),
    'exports.eventName = "guildMemberAdd";\nexports.prodOnly = true;\nexports.execute = () => {};\n',
  );
});

afterAll(() => {
  fs.rmSync(eventsDir, { recursive: true, force: true });
});

function registeredEvents(deployment: { production: boolean }) {
  envMode.isProductionDeployment = deployment.production;
  const on = vi.fn();
  const client = { on } as unknown as Client;
  return loadEventHandlers(client, eventsDir).then(() =>
    on.mock.calls.map(([eventName]) => eventName as string).sort(),
  );
}

describe("loadEventHandlers", () => {
  it("skips production-only events on a deployment that is not production", async () => {
    expect(await registeredEvents({ production: false })).toEqual([
      "messageCreate",
    ]);
  });

  it("registers production-only events on the production deployment", async () => {
    expect(await registeredEvents({ production: true })).toEqual([
      "guildMemberAdd",
      "messageCreate",
    ]);
  });
});
