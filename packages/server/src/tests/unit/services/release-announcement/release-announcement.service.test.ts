import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  isProd: true,
  isDevDeployment: false,
  version: "1.66.0",
  announced: null as string | null,
  failRead: false,
  failWrite: false,
  changelog: "" as string | null,
}));

vi.mock("@/db", () => ({ Q: {} }));

vi.mock("@/config", async (importOriginal) => {
  const module = await importOriginal<typeof import("@/config")>();
  const actual = module.default;
  return {
    ...module,
    default: {
      ...actual,
      envMode: {
        ...actual.envMode,
        get isProd() {
          return state.isProd;
        },
        get isDevDeployment() {
          return state.isDevDeployment;
        },
      },
      app: {
        ...actual.app,
        get version() {
          return state.version;
        },
      },
      meta: {
        ...actual.meta,
        links: { ...actual.meta.links, website: "https://createrington.test/" },
      },
    },
  };
});

vi.mock("@/services/settings", () => ({
  settings: {
    getAnnouncedAppVersion: async () => {
      if (state.failRead) throw new Error("connection refused");
      return state.announced;
    },
    setAnnouncedAppVersion: async (version: string) => {
      if (state.failWrite) throw new Error("connection refused");
      state.announced = version;
    },
  },
}));

vi.mock("@/services/app-changelog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/app-changelog")>()),
  readAppChangelog: async () => {
    if (state.changelog === null) throw new Error("ENOENT");
    return state.changelog;
  },
}));

import type { SendMessageOptions } from "@/services/discord/message/types";
import { Discord } from "@/discord/constants";
import { releaseAnnouncementService } from "@/services/release-announcement";

const CHANGELOG = [
  "## v1.66.0 (2026-10-10)",
  "",
  "### @createrington/server (1.66.1 → 1.67.0)",
  "- [add] Add a `/ticket remove` admin subcommand",
  "- [fix] Fix closing a ticket only locking out its owner",
  "",
  "## v1.65.3 (2026-10-08)",
  "",
  "### @createrington/client (0.2.82 → 0.2.83)",
  "- [add] Add Saidai_V to the team page",
].join("\n");

const sent: SendMessageOptions[] = [];
const send = {
  result: { success: true } as { success: boolean; error?: string },
};

interface SentNode {
  type: number;
  content?: string;
  url?: string;
  components?: SentNode[];
}

function lastMessage() {
  const options = sent[sent.length - 1];
  const container = (
    options.components as unknown as Array<{
      toJSON: () => { components: SentNode[] };
    }>
  )[0].toJSON();

  const lines = container.components
    .filter((node) => node.type === 10)
    .flatMap((node) => (node.content ?? "").split("\n"));
  const buttonUrl = container.components
    .flatMap((node) => node.components ?? [])
    .find((node) => node.url)?.url;

  return { options, lines, buttonUrl };
}

beforeEach(() => {
  sent.length = 0;
  send.result = { success: true };
  state.isProd = true;
  state.isDevDeployment = false;
  state.version = "1.66.0";
  state.announced = "1.65.3";
  state.failRead = false;
  state.failWrite = false;
  state.changelog = CHANGELOG;

  Discord._setMessageService({
    send: async (options: SendMessageOptions) => {
      sent.push(options);
      return send.result;
    },
  } as unknown as Parameters<typeof Discord._setMessageService>[0]);
});

describe("ReleaseAnnouncementService.announceIfNew", () => {
  it("announces a new version to the admin notifications channel without pinging anyone", async () => {
    await releaseAnnouncementService.announceIfNew();

    expect(sent).toHaveLength(1);
    const message = lastMessage();
    expect(message.options.channelId).toBe(
      Discord.Channels.administration.NOTIFICATIONS,
    );
    expect(message.options.content).toBeUndefined();
    expect(message.options.allowedMentions).toEqual({ parse: [] });
    expect(message.lines).toEqual([
      "### App v1.66.0 is live",
      "-# Released Oct 10, 2026",
      "**1** addition · **1** fix",
    ]);
    expect(message.buttonUrl).toBe(
      "https://createrington.test/admin/changelog#v1.66.0",
    );
    expect(state.announced).toBe("1.66.0");
  });

  it("stays silent when the running version was announced already", async () => {
    state.announced = "1.66.0";

    await releaseAnnouncementService.announceIfNew();

    expect(sent).toHaveLength(0);
  });

  it("announces once across restarts of the same version", async () => {
    await releaseAnnouncementService.announceIfNew();
    await releaseAnnouncementService.announceIfNew();

    expect(sent).toHaveLength(1);
  });

  it("announces the running version when none was announced before", async () => {
    state.announced = null;

    await releaseAnnouncementService.announceIfNew();

    expect(sent).toHaveLength(1);
    expect(state.announced).toBe("1.66.0");
  });

  it("stays silent on the dev deployment and outside production", async () => {
    state.isDevDeployment = true;
    await releaseAnnouncementService.announceIfNew();

    state.isDevDeployment = false;
    state.isProd = false;
    await releaseAnnouncementService.announceIfNew();

    expect(sent).toHaveLength(0);
    expect(state.announced).toBe("1.65.3");
  });

  it.each(["unknown", "1.66.0-dev.9ba7a2fc"])(
    "stays silent for the non-release version %s",
    async (version) => {
      state.version = version;

      await releaseAnnouncementService.announceIfNew();

      expect(sent).toHaveLength(0);
      expect(state.announced).toBe("1.65.3");
    },
  );

  it("announces the bare version with an unanchored link when the changelog has no section for it", async () => {
    state.version = "1.66.1";

    await releaseAnnouncementService.announceIfNew();

    const message = lastMessage();
    expect(message.lines).toEqual(["### App v1.66.1 is live"]);
    expect(message.buttonUrl).toBe(
      "https://createrington.test/admin/changelog",
    );
    expect(state.announced).toBe("1.66.1");
  });

  it("still announces when the changelog cannot be read", async () => {
    state.changelog = null;

    await releaseAnnouncementService.announceIfNew();

    expect(lastMessage().lines).toEqual(["### App v1.66.0 is live"]);
    expect(state.announced).toBe("1.66.0");
  });

  it("keeps the stored version when the post fails, so the next start retries", async () => {
    send.result = { success: false, error: "Missing Access" };

    await releaseAnnouncementService.announceIfNew();
    expect(state.announced).toBe("1.65.3");

    send.result = { success: true };
    await releaseAnnouncementService.announceIfNew();
    expect(sent).toHaveLength(2);
    expect(state.announced).toBe("1.66.0");
  });

  it("posts nothing when the stored version cannot be read", async () => {
    state.failRead = true;

    await expect(
      releaseAnnouncementService.announceIfNew(),
    ).resolves.toBeUndefined();

    expect(sent).toHaveLength(0);
  });

  it("does not throw when storing the announced version fails", async () => {
    state.failWrite = true;

    await expect(
      releaseAnnouncementService.announceIfNew(),
    ).resolves.toBeUndefined();

    expect(sent).toHaveLength(1);
  });
});
