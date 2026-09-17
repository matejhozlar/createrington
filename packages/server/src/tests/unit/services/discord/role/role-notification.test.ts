import { describe, it, expect, vi, beforeEach } from "vitest";

const player = vi.hoisted(() => ({
  row: null as { minecraftUuid: string; minecraftUsername: string } | null,
}));
const skinApi = vi.hoisted(() => ({
  render: vi.fn<() => Promise<Uint8Array>>(),
}));

vi.mock("@/db", () => ({
  Q: { player: { find: async () => player.row } },
}));

vi.mock("@/services/skin-api", () => ({
  getSkinApiClient: () => ({ render: skinApi.render }),
}));

vi.mock("@/discord/utils/pose-thumbnail", () => ({
  squarePoseThumbnail: async (png: Uint8Array) => Buffer.from(png),
}));

import type { SendMessageOptions } from "@/services/discord/message/types";
import { Discord } from "@/discord/constants";
import { roleNotificationService } from "@/services/discord/role/role-notification.service";
import {
  RoleCheckInterval,
  RoleConditionType,
  type RoleAssignmentNotification,
} from "@/services/discord/role/types";

const sent: SendMessageOptions[] = [];

interface SentText {
  type: number;
  content?: string;
  components?: SentText[];
  accessory?: { media?: { url: string } };
}

function lastMessage() {
  const options = sent[sent.length - 1];
  const container = (
    options.components as unknown as Array<{
      toJSON: () => { accent_color?: number; components: SentText[] };
    }>
  )[0].toJSON();

  const texts: string[] = [];
  let accessoryUrl: string | undefined;
  for (const child of container.components) {
    if (child.type === 10 && child.content) texts.push(child.content);
    if (child.type === 9) {
      for (const text of child.components ?? []) {
        if (text.content) texts.push(text.content);
      }
      accessoryUrl = child.accessory?.media?.url;
    }
  }

  return {
    texts,
    accessoryUrl,
    accentColor: container.accent_color,
    files: options.files,
  };
}

function notification(
  overrides: Partial<RoleAssignmentNotification> = {},
): RoleAssignmentNotification {
  return {
    discordId: "211712133550473217",
    username: "saunhardy",
    role: {
      roleId: Discord.Roles.BRASS_TECHNICIAN,
      label: "Brass Technician",
      checkInterval: RoleCheckInterval.REALTIME,
      conditionType: RoleConditionType.PLAYTIME,
      requiredSeconds: 360000,
    },
    roleColor: 0xb5825a,
    currentValue: 372420,
    requiredValue: 360000,
    timestamp: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  sent.length = 0;
  player.row = { minecraftUuid: "uuid-1", minecraftUsername: "saunhardy" };
  skinApi.render.mockReset();
  skinApi.render.mockResolvedValue(Uint8Array.from([1, 2, 3]));

  Discord._setMessageService({
    send: async (options: SendMessageOptions) => {
      sent.push(options);
      return { success: true, messageId: "1" };
    },
  } as unknown as Parameters<typeof Discord._setMessageService>[0]);
});

describe("RoleNotificationService.sendNotification", () => {
  it("announces a playtime role with the attached pose and the role color", async () => {
    await roleNotificationService.sendNotification(notification());
    const message = lastMessage();

    expect(message.texts).toEqual([
      "### Brass Technician",
      "<@211712133550473217> has ranked up.",
      "-# 103h 27m total playtime",
    ]);
    expect(message.accessoryUrl).toBe("attachment://rank-up.png");
    expect(message.files).toHaveLength(1);
    expect(message.accentColor).toBe(0xb5825a);
  });

  it("maps a server age role to a day count", async () => {
    await roleNotificationService.sendNotification(
      notification({
        role: {
          roleId: Discord.Roles.VETERAN,
          label: "Veteran",
          checkInterval: RoleCheckInterval.DAILY,
          conditionType: RoleConditionType.SERVER_AGE,
          requiredDays: 180,
        },
        currentValue: 194,
        requiredValue: 180,
      }),
    );

    expect(lastMessage().texts[2]).toBe("-# 194 days in the server");
  });

  it("maps a top balance role to money and the competitive wording", async () => {
    await roleNotificationService.sendNotification(
      notification({
        role: {
          roleId: Discord.Roles.CAPITALIST,
          label: "Capitalist",
          checkInterval: RoleCheckInterval.DAILY,
          conditionType: RoleConditionType.TOP_BALANCE,
          gameRankId: "capitalist",
        },
        currentValue: 1204000,
        requiredValue: 0,
      }),
    );

    expect(lastMessage().texts.slice(1)).toEqual([
      "<@211712133550473217> now holds the largest fortune on the server.",
      "-# $1,204,000 balance",
    ]);
  });

  it("leaves the container stripeless when the role has no color", async () => {
    await roleNotificationService.sendNotification(
      notification({ roleColor: 0 }),
    );

    expect(lastMessage().accentColor).toBeUndefined();
  });

  it("falls back to the square mc-heads head when the render fails", async () => {
    skinApi.render.mockRejectedValue(new Error("skin-api down"));

    await roleNotificationService.sendNotification(notification());
    const message = lastMessage();

    expect(message.accessoryUrl).toBe("https://mc-heads.net/avatar/uuid-1");
    expect(message.files).toBeUndefined();
  });

  it("drops the figure for a member with no registered account", async () => {
    player.row = null;

    await roleNotificationService.sendNotification(notification());
    const message = lastMessage();

    expect(message.accessoryUrl).toBeUndefined();
    expect(message.texts).toHaveLength(3);
    expect(skinApi.render).not.toHaveBeenCalled();
  });

  it("pings only the player who ranked up", async () => {
    await roleNotificationService.sendNotification(notification());

    expect(sent[0].allowedMentions).toEqual({
      users: ["211712133550473217"],
    });
  });
});
