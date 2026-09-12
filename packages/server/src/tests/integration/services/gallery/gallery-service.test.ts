import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";

vi.mock("@/services/feature-flag", () => ({
  FeatureFlags: { gallery: "gallery" },
  featureFlagService: { isEnabled: vi.fn(async () => true) },
}));

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pool, { Q } from "@/db";
import { featureFlagService } from "@/services/feature-flag";
import type { DiscordStickyMessageService } from "@/services/discord/sticky-message";
import {
  GalleryService,
  type IntakeAttachment,
  type IntakeMessage,
} from "@/services/gallery";

const RUN = Date.now().toString();
let seq = 0;
const nextId = () => `${RUN}${(seq++).toString().padStart(3, "0")}`;

const CHANNEL_ID = `9${RUN}`;
const PLAYER_UUID = randomUUID();
const DISCORD_ID = `8${RUN}`;

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(32),
]);

const isEnabled = vi.mocked(featureFlagService.isEnabled);

const sticky = {
  ensure: vi.fn(async () => {}),
  touch: vi.fn(),
  repost: vi.fn(async () => {}),
  shutdown: vi.fn(async () => {}),
};

let originalsDir: string;
let serverId: number;
let service: GalleryService;

function attachment(
  overrides: Partial<IntakeAttachment> = {},
): IntakeAttachment {
  return {
    id: nextId(),
    name: "shot.png",
    url: "https://cdn.example/shot.png",
    size: 4096,
    contentType: "image/png",
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

function message(overrides: Partial<IntakeMessage> = {}): IntakeMessage {
  return {
    id: nextId(),
    channelId: CHANNEL_ID,
    authorId: DISCORD_ID,
    authorIsBot: false,
    content: "  my new station  ",
    attachments: [attachment()],
    ...overrides,
  };
}

async function download(url: string): Promise<Buffer> {
  if (url.endsWith(".jpg")) return JPEG;
  if (url.endsWith(".bad")) return Buffer.from("definitely not an image");
  return PNG;
}

async function storedFiles(): Promise<string[]> {
  return (await fs.readdir(originalsDir)).sort();
}

beforeAll(async () => {
  originalsDir = await fs.mkdtemp(path.join(os.tmpdir(), "gallery-test-"));

  const server = await Q.server.createAndReturn({
    name: `Gallery Test ${RUN}`,
    identifier: `gallery-test-${RUN}`,
  });
  serverId = server.id;

  await Q.player.create({
    minecraftUuid: PLAYER_UUID,
    minecraftUsername: `gallery_${RUN.slice(-8)}`,
    discordId: DISCORD_ID,
  });

  service = new GalleryService(
    sticky as unknown as DiscordStickyMessageService,
    { intakeChannelId: CHANNEL_ID, originalsDir, serverId, download },
  );
  await service.initialize();
});

beforeEach(() => {
  vi.clearAllMocks();
  isEnabled.mockResolvedValue(true);
});

afterAll(async () => {
  await Q.player.delete({ minecraftUuid: PLAYER_UUID });
  await Q.server.delete({ id: serverId });
  await fs.rm(originalsDir, { recursive: true, force: true });
  await pool.end();
});

describe("GalleryService.ingest", () => {
  it("creates one pending submission per image attachment and stores the originals", async () => {
    const png = attachment();
    const jpg = attachment({
      name: "shot.jpg",
      url: "https://cdn.example/shot.jpg",
      contentType: "image/jpeg",
      width: null,
      height: null,
    });
    const text = attachment({
      name: "notes.txt",
      url: "https://cdn.example/notes.txt",
      contentType: "text/plain",
    });
    const msg = message({ attachments: [png, jpg, text] });

    const { created } = await service.ingest(msg);

    expect(created).toHaveLength(2);
    expect(created.map((s) => s.status)).toEqual(["pending", "pending"]);
    expect(created.map((s) => s.caption)).toEqual([
      "my new station",
      "my new station",
    ]);
    expect(created.map((s) => s.originalContentType)).toEqual([
      "image/png",
      "image/jpeg",
    ]);
    expect(created[0]).toMatchObject({
      playerMinecraftUuid: PLAYER_UUID,
      serverId,
      sourceChannelId: CHANNEL_ID,
      sourceMessageId: msg.id,
      sourceAttachmentId: png.id,
      originalPath: `${msg.id}-${png.id}.png`,
      originalBytes: PNG.length,
      width: 1920,
      height: 1080,
    });
    expect(created[1]).toMatchObject({
      originalPath: `${msg.id}-${jpg.id}.jpg`,
      width: null,
      height: null,
    });

    for (const submission of created) {
      const bytes = await fs.readFile(service.originalFilePath(submission));
      expect(bytes.length).toBe(submission.originalBytes);
    }
    expect(sticky.touch).toHaveBeenCalledTimes(1);
  });

  it("does not ingest the same attachment twice", async () => {
    const msg = message();

    const first = await service.ingest(msg);
    const second = await service.ingest(msg);

    expect(first.created).toHaveLength(1);
    expect(second.created).toHaveLength(0);
    expect(
      await Q.gallery.submission.where({ sourceMessageId: msg.id }).all(),
    ).toHaveLength(1);
  });

  it("ignores bot authors, other channels, and unregistered players", async () => {
    const before = await storedFiles();

    expect(
      (await service.ingest(message({ authorIsBot: true }))).created,
    ).toHaveLength(0);
    expect(
      (await service.ingest(message({ channelId: `1${RUN}` }))).created,
    ).toHaveLength(0);
    expect(
      (await service.ingest(message({ authorId: `7${RUN}` }))).created,
    ).toHaveLength(0);

    expect(await storedFiles()).toEqual(before);
  });

  it("does nothing while the feature flag is off", async () => {
    isEnabled.mockResolvedValueOnce(false);

    const { created } = await service.ingest(message());

    expect(created).toHaveLength(0);
    expect(sticky.touch).not.toHaveBeenCalled();
  });

  it("skips attachments whose bytes are not a supported image", async () => {
    const bad = attachment({
      name: "shot.bad",
      url: "https://cdn.example/shot.bad",
    });
    const before = await storedFiles();

    const { created } = await service.ingest(message({ attachments: [bad] }));

    expect(created).toHaveLength(0);
    expect(await storedFiles()).toEqual(before);
  });
});

describe("GalleryService.withdrawByMessage", () => {
  it("withdraws pending submissions and deletes their originals", async () => {
    const msg = message({ attachments: [attachment(), attachment()] });
    const { created } = await service.ingest(msg);

    const withdrawn = await service.withdrawByMessage(msg.id);

    expect(withdrawn).toBe(2);
    const rows = await Q.gallery.submission
      .where({ sourceMessageId: msg.id })
      .all();
    expect(rows.map((r) => r.status)).toEqual(["withdrawn", "withdrawn"]);
    for (const submission of created) {
      await expect(
        fs.access(service.originalFilePath(submission)),
      ).rejects.toThrow();
    }
  });

  it("leaves reviewed submissions untouched", async () => {
    const msg = message();
    const { created } = await service.ingest(msg);
    await Q.gallery.submission.update(
      { id: created[0].id },
      { status: "approved" },
    );

    expect(await service.withdrawByMessage(msg.id)).toBe(0);
    const row = await Q.gallery.submission.find({ id: created[0].id });
    expect(row?.status).toBe("approved");
    await expect(
      fs.access(service.originalFilePath(created[0])),
    ).resolves.toBeUndefined();
  });
});

describe("GalleryService.updateCaption", () => {
  it("copies the edited text onto pending submissions only", async () => {
    const msg = message({ attachments: [attachment(), attachment()] });
    const { created } = await service.ingest(msg);
    await Q.gallery.submission.update(
      { id: created[1].id },
      { status: "rejected" },
    );

    expect(await service.updateCaption(msg.id, "  renamed  ")).toBe(1);

    const first = await Q.gallery.submission.find({ id: created[0].id });
    const second = await Q.gallery.submission.find({ id: created[1].id });
    expect(first?.caption).toBe("renamed");
    expect(second?.caption).toBe("my new station");
  });

  it("clears the caption when the message text is emptied", async () => {
    const msg = message();
    const { created } = await service.ingest(msg);

    await service.updateCaption(msg.id, "   ");

    const row = await Q.gallery.submission.find({ id: created[0].id });
    expect(row?.caption).toBeNull();
  });
});
