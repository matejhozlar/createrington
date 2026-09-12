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

vi.mock("@/services/gallery/discord", () => ({
  announceApproval: vi.fn(async () => ({
    channelId: "announce-channel",
    messageId: "announce-message",
  })),
  deleteAnnouncement: vi.fn(async () => {}),
  markSourceMessage: vi.fn(async () => {}),
  galleryPageUrl: vi.fn(() => "https://example.test/gallery"),
}));

vi.mock("@/services/storage", () => {
  const objects = new Map<string, { contentType: string; size: number }>();
  return {
    objectStorage: {
      enabled: true,
      objects,
      put: vi.fn(
        async (object: { key: string; body: Buffer; contentType: string }) => {
          objects.set(object.key, {
            contentType: object.contentType,
            size: object.body.length,
          });
        },
      ),
      delete: vi.fn(async (keys: string[]) => {
        for (const key of keys) objects.delete(key);
      }),
      publicUrl: (key: string) => `https://cdn.test/${key}`,
    },
  };
});

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import pool, { balanceRepo, Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { settings } from "@/services/settings";
import { objectStorage } from "@/services/storage";
import {
  announceApproval,
  deleteAnnouncement,
  markSourceMessage,
} from "@/services/gallery/discord";
import type { DiscordStickyMessageService } from "@/services/discord/sticky-message";
import {
  GalleryService,
  type IntakeAttachment,
  type IntakeMessage,
} from "@/services/gallery";

const RUN = Date.now().toString();
let seq = 0;
const nextId = () => `${RUN}${(seq++).toString().padStart(3, "0")}`;

const CHANNEL_ID = `6${RUN}`;
const ADMIN_DISCORD_ID = `5${RUN}`;
const AUTHOR = { uuid: randomUUID(), discordId: `4${RUN}` };
const CREDITED = { uuid: randomUUID(), discordId: `3${RUN}` };
const STRANGER = { uuid: randomUUID(), discordId: `2${RUN}` };

const storage = objectStorage as unknown as {
  enabled: boolean;
  objects: Map<string, { contentType: string; size: number }>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const sticky = {
  ensure: vi.fn(async () => {}),
  touch: vi.fn(),
  repost: vi.fn(async () => {}),
  shutdown: vi.fn(async () => {}),
};

let png: Buffer;
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
    width: 64,
    height: 48,
    ...overrides,
  };
}

function message(overrides: Partial<IntakeMessage> = {}): IntakeMessage {
  return {
    id: nextId(),
    channelId: CHANNEL_ID,
    authorId: AUTHOR.discordId,
    authorIsBot: false,
    content: "my station",
    attachments: [attachment()],
    ...overrides,
  };
}

async function submit() {
  const { created } = await service.ingest(message());
  expect(created).toHaveLength(1);
  return created[0];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  png = await sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer();

  originalsDir = await fs.mkdtemp(path.join(os.tmpdir(), "gallery-review-"));

  const server = await Q.server.createAndReturn({
    name: `Gallery Review ${RUN}`,
    identifier: `gallery-review-${RUN}`,
  });
  serverId = server.id;

  for (const [index, player] of [AUTHOR, CREDITED, STRANGER].entries()) {
    await Q.player.create({
      minecraftUuid: player.uuid,
      minecraftUsername: `gal${index}_${RUN.slice(-8)}`,
      discordId: player.discordId,
    });
  }

  service = new GalleryService(
    sticky as unknown as DiscordStickyMessageService,
    {
      intakeChannelId: CHANNEL_ID,
      originalsDir,
      serverId,
      download: async () => png,
    },
  );
  await service.initialize();
});

beforeEach(async () => {
  vi.clearAllMocks();
  storage.enabled = true;
  await settings.setGalleryRewardAmount(120, ADMIN_DISCORD_ID);
  // High enough that rewards paid by earlier cases in this file cannot push
  // the shared author over the rolling window; the cap cases lower it.
  await settings.setGalleryWeeklyRewardCap(100, ADMIN_DISCORD_ID);
});

afterAll(async () => {
  for (const player of [AUTHOR, CREDITED, STRANGER]) {
    await Q.player.delete({ minecraftUuid: player.uuid });
  }
  await Q.server.delete({ id: serverId });
  await Q.app.setting.delete({ key: "gallery_reward_amount" });
  await Q.app.setting.delete({ key: "gallery_weekly_reward_cap" });
  await fs.rm(originalsDir, { recursive: true, force: true });
  await pool.end();
});

describe("GalleryService.approve", () => {
  it("publishes variants, pays the reward, records credits, and announces", async () => {
    const pending = await submit();
    const balanceBefore = await balanceRepo
      .getAmount({ minecraftUuid: AUTHOR.uuid })
      .catch(() => 0);

    const result = await service.approve(
      pending.id,
      { discordId: ADMIN_DISCORD_ID },
      {
        caption: "  Central station  ",
        creditPlayerUuids: [CREDITED.uuid, AUTHOR.uuid, CREDITED.uuid],
      },
    );

    expect(result).toMatchObject({
      rewardPaid: 120,
      capReached: false,
      announced: true,
    });
    const { submission } = result;
    expect(submission).toMatchObject({
      status: "approved",
      caption: "Central station",
      width: 64,
      height: 48,
      reviewedBy: ADMIN_DISCORD_ID,
      rewardAmount: 120,
      announcementChannelId: "announce-channel",
      announcementMessageId: "announce-message",
    });
    expect(submission.fullKey).toMatch(
      new RegExp(`^gallery/${pending.id}-[0-9a-f]{12}\\.webp$`),
    );
    expect(submission.thumbKey).toMatch(
      new RegExp(`^gallery/${pending.id}-[0-9a-f]{12}-thumb\\.webp$`),
    );
    expect(submission.reviewedAt).toBeInstanceOf(Date);
    expect(submission.rewardTransactionId).not.toBeNull();

    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(storage.objects.get(submission.fullKey!)?.contentType).toBe(
      "image/webp",
    );
    expect(storage.objects.get(submission.thumbKey!)?.contentType).toBe(
      "image/webp",
    );

    expect(await balanceRepo.getAmount({ minecraftUuid: AUTHOR.uuid })).toBe(
      balanceBefore + 120,
    );
    const ledger = await Q.player.balance.transaction.find({
      id: submission.rewardTransactionId!,
    });
    expect(ledger).toMatchObject({
      playerMinecraftUuid: AUTHOR.uuid,
      transactionType: "gallery_reward",
      idempotencyKey: `gallery-reward:${pending.id}`,
    });

    const credits = await Q.gallery.submission.credit
      .where({ submissionId: pending.id })
      .all();
    expect(credits.map((credit) => credit.playerMinecraftUuid)).toEqual([
      CREDITED.uuid,
    ]);

    const credited = await Q.player.find({ minecraftUuid: CREDITED.uuid });
    expect(announceApproval).toHaveBeenCalledWith({
      submissionId: pending.id,
      authorDiscordId: AUTHOR.discordId,
      caption: "Central station",
      creditNames: [credited?.minecraftUsername],
      rewardAmount: 120,
      imageUrl: `https://cdn.test/${submission.fullKey}`,
    });
    expect(markSourceMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      pending.sourceMessageId,
      "approved",
    );
    expect(await fileExists(service.originalFilePath(pending))).toBe(true);
    expect(service.imageUrls(submission)).toEqual({
      full: `https://cdn.test/${submission.fullKey}`,
      thumb: `https://cdn.test/${submission.thumbKey}`,
    });
  });

  it("keeps the original caption and pays nothing when the reward is set to 0", async () => {
    const pending = await submit();
    const balanceBefore = await balanceRepo.getAmount({
      minecraftUuid: AUTHOR.uuid,
    });

    const result = await service.approve(
      pending.id,
      { discordId: ADMIN_DISCORD_ID },
      { rewardAmount: 0 },
    );

    expect(result.rewardPaid).toBe(0);
    expect(result.submission.caption).toBe("my station");
    expect(result.submission.rewardAmount).toBe(0);
    expect(result.submission.rewardTransactionId).toBeNull();
    expect(await balanceRepo.getAmount({ minecraftUuid: AUTHOR.uuid })).toBe(
      balanceBefore,
    );
  });

  it("stops paying once the weekly cap is reached but still publishes", async () => {
    await settings.setGalleryWeeklyRewardCap(1, ADMIN_DISCORD_ID);
    const usedBefore = await service.weeklyRewardsUsed(AUTHOR.uuid);
    expect(usedBefore).toBeGreaterThanOrEqual(1);

    const pending = await submit();
    const result = await service.approve(pending.id, {
      discordId: ADMIN_DISCORD_ID,
    });

    expect(result).toMatchObject({
      rewardPaid: 0,
      capReached: true,
      announced: true,
    });
    expect(result.submission.status).toBe("approved");
    expect(result.submission.rewardTransactionId).toBeNull();
  });

  it("reports the cap even when the reviewer also asked for nothing", async () => {
    await settings.setGalleryWeeklyRewardCap(1, ADMIN_DISCORD_ID);

    const pending = await submit();
    const result = await service.approve(
      pending.id,
      { discordId: ADMIN_DISCORD_ID },
      { rewardAmount: 0 },
    );

    expect(result).toMatchObject({ rewardPaid: 0, capReached: true });
  });

  it("pays only once when the same submission is approved concurrently", async () => {
    const pending = await submit();
    const balanceBefore = await balanceRepo.getAmount({
      minecraftUuid: AUTHOR.uuid,
    });

    const results = await Promise.allSettled([
      service.approve(pending.id, { discordId: ADMIN_DISCORD_ID }),
      service.approve(pending.id, { discordId: ADMIN_DISCORD_ID }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictError,
    );

    const ledger = await Q.player.balance.transaction
      .where({ idempotencyKey: `gallery-reward:${pending.id}` })
      .all();
    expect(ledger).toHaveLength(1);
    expect(await balanceRepo.getAmount({ minecraftUuid: AUTHOR.uuid })).toBe(
      balanceBefore + 120,
    );

    const winner = (
      fulfilled[0] as PromiseFulfilledResult<
        Awaited<ReturnType<typeof service.approve>>
      >
    ).value.submission;
    expect(storage.objects.has(winner.fullKey!)).toBe(true);
    const orphans = [...storage.objects.keys()].filter(
      (key) =>
        key.startsWith(`gallery/${pending.id}-`) &&
        key !== winner.fullKey &&
        key !== winner.thumbKey,
    );
    expect(orphans).toEqual([]);
  });

  it("refuses to publish when the stored original is gone", async () => {
    const pending = await submit();
    await fs.rm(service.originalFilePath(pending));

    await expect(
      service.approve(pending.id, { discordId: ADMIN_DISCORD_ID }),
    ).rejects.toBeInstanceOf(ConflictError);

    const row = await Q.gallery.submission.find({ id: pending.id });
    expect(row?.status).toBe("pending");
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("refuses non-pending, unknown, and storage-less approvals", async () => {
    const pending = await submit();
    await service.approve(pending.id, { discordId: ADMIN_DISCORD_ID });

    await expect(
      service.approve(pending.id, { discordId: ADMIN_DISCORD_ID }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      service.approve(999_999_999, { discordId: ADMIN_DISCORD_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const another = await submit();
    storage.enabled = false;
    await expect(
      service.approve(another.id, { discordId: ADMIN_DISCORD_ID }),
    ).rejects.toBeInstanceOf(BadRequestError);
    const row = await Q.gallery.submission.find({ id: another.id });
    expect(row?.status).toBe("pending");
  });
});

describe("GalleryService.reject", () => {
  it("marks the submission rejected, stores the note, and deletes the original", async () => {
    const pending = await submit();

    const rejected = await service.reject(
      pending.id,
      { discordId: ADMIN_DISCORD_ID },
      "  blurry  ",
    );

    expect(rejected).toMatchObject({
      status: "rejected",
      reviewedBy: ADMIN_DISCORD_ID,
      rejectNote: "blurry",
    });
    expect(await fileExists(service.originalFilePath(pending))).toBe(false);
    expect(markSourceMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      pending.sourceMessageId,
      "rejected",
    );
    await expect(
      service.reject(pending.id, { discordId: ADMIN_DISCORD_ID }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("GalleryService.remove", () => {
  it("lets only the author or an admin pull an approved screenshot", async () => {
    const pending = await submit();
    const { submission } = await service.approve(pending.id, {
      discordId: ADMIN_DISCORD_ID,
    });

    await expect(
      service.remove(pending.id, {
        discordId: STRANGER.discordId,
        isAdmin: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const removed = await service.remove(pending.id, {
      discordId: AUTHOR.discordId,
      isAdmin: false,
    });

    expect(removed).toMatchObject({
      status: "withdrawn",
      announcementChannelId: null,
      announcementMessageId: null,
      rewardAmount: 120,
    });
    expect(storage.delete).toHaveBeenCalledWith([
      submission.fullKey,
      submission.thumbKey,
    ]);
    expect(storage.objects.has(submission.fullKey!)).toBe(false);
    expect(deleteAnnouncement).toHaveBeenCalledWith({
      channelId: "announce-channel",
      messageId: "announce-message",
    });
    expect(await fileExists(service.originalFilePath(pending))).toBe(false);
  });

  it("allows admins and refuses submissions that are not approved", async () => {
    const pending = await submit();
    await expect(
      service.remove(pending.id, {
        discordId: ADMIN_DISCORD_ID,
        isAdmin: true,
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    await service.approve(pending.id, { discordId: ADMIN_DISCORD_ID });
    const removed = await service.remove(pending.id, {
      discordId: ADMIN_DISCORD_ID,
      isAdmin: true,
    });
    expect(removed.status).toBe("withdrawn");
  });
});
