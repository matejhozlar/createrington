import { describe, it, expect } from "vitest";
import {
  HallOfFameComponentPresets,
  type RankUpAnnouncementInput,
} from "@/discord/components/presets/hall-of-fame";
import {
  buildComponentsMessage,
  validateComponentsV2,
} from "@/discord/components";
import type {
  ComponentContainer,
  ComponentsData,
} from "@createrington/shared/api/embed";

const POSE_URL = "attachment://rank-up.png";
const ROLE_COLOR = 0xb5825a;

function input(
  overrides: Partial<RankUpAnnouncementInput> = {},
): RankUpAnnouncementInput {
  return {
    discordId: "123",
    playerName: "saunhardy",
    roleLabel: "Brass Technician",
    metric: { kind: "playtime", seconds: 372420 },
    poseUrl: POSE_URL,
    accentColor: ROLE_COLOR,
    competitive: false,
    ...overrides,
  };
}

function only(data: ComponentsData): ComponentContainer {
  const [node] = data.components;
  if (node.type !== "container") throw new Error("expected a container");
  return node;
}

function texts(data: ComponentsData): string[] {
  const [child] = only(data).components;
  if (child.type === "section") return child.components.map((t) => t.content);
  return only(data).components.flatMap((c) =>
    c.type === "text" ? [c.content] : [],
  );
}

describe("HallOfFameComponentPresets.rankUp", () => {
  it("builds a valid message", () => {
    const data = HallOfFameComponentPresets.rankUp(input());

    expect(validateComponentsV2(data)).toBeNull();
    expect(() => buildComponentsMessage(data)).not.toThrow();
  });

  it("leads with the new role and keeps the running total as subtext", () => {
    expect(texts(HallOfFameComponentPresets.rankUp(input()))).toEqual([
      "### Brass Technician",
      "<@123> has ranked up.",
      "-# 103h 27m total playtime",
    ]);
  });

  it("puts the pose render beside the text", () => {
    const [child] = only(HallOfFameComponentPresets.rankUp(input())).components;

    expect(child.type).toBe("section");
    if (child.type !== "section") return;
    expect(child.accessory).toMatchObject({
      type: "thumbnail",
      url: POSE_URL,
      description: "saunhardy's skin",
    });
  });

  it("stripes the container with the role's own color", () => {
    expect(only(HallOfFameComponentPresets.rankUp(input())).accentColor).toBe(
      ROLE_COLOR,
    );
    expect(
      only(HallOfFameComponentPresets.rankUp(input({ accentColor: undefined })))
        .accentColor,
    ).toBeUndefined();
  });

  it("announces competitive roles as holding the top spot", () => {
    const data = HallOfFameComponentPresets.rankUp(
      input({
        roleLabel: "The Sleepless",
        competitive: true,
      }),
    );

    expect(texts(data)[1]).toBe(
      "<@123> now holds the most playtime on the server.",
    );
  });

  it("reads the same for a membership role, with the day count as subtext", () => {
    const data = HallOfFameComponentPresets.rankUp(
      input({
        roleLabel: "Veteran",
        metric: { kind: "membership", days: 194 },
      }),
    );

    expect(texts(data)).toEqual([
      "### Veteran",
      "<@123> has ranked up.",
      "-# 194 days in the server",
    ]);
  });

  it("formats the balance and membership totals", () => {
    expect(
      texts(
        HallOfFameComponentPresets.rankUp(
          input({ metric: { kind: "balance", amount: 1204000 } }),
        ),
      )[2],
    ).toBe("-# $1,204,000 balance");

    expect(
      texts(
        HallOfFameComponentPresets.rankUp(
          input({ metric: { kind: "membership", days: 365 } }),
        ),
      )[2],
    ).toBe("-# 365 days in the server");
  });

  it("falls back to plain text when there is no pose to show", () => {
    const data = HallOfFameComponentPresets.rankUp(
      input({ poseUrl: undefined }),
    );

    expect(validateComponentsV2(data)).toBeNull();
    expect(only(data).components.every((c) => c.type === "text")).toBe(true);
    expect(texts(data)).toHaveLength(3);
  });
});
