import { describe, it, expect } from "vitest";
import { ButtonStyle, ComponentType } from "discord.js";
import {
  AppReleaseComponentPresets,
  type AppReleaseNotice,
} from "@/discord/components/presets/app-release";
import {
  buildComponentsMessage,
  validateComponentsV2,
} from "@/discord/components";
import { ComponentColors } from "@/discord/components/colors";
import type { ReleaseSummary } from "@/services/app-changelog";
import type {
  ComponentContainer,
  ComponentsData,
} from "@createrington/shared/api/embed";

const CHANGELOG_URL = "https://createrington.test/admin/changelog#v1.66.0";

function counts(
  overrides: Partial<ReleaseSummary["counts"]> = {},
): ReleaseSummary["counts"] {
  return {
    add: 0,
    fix: 0,
    refactor: 0,
    remove: 0,
    security: 0,
    chore: 0,
    tweak: 0,
    change: 0,
    ...overrides,
  };
}

function input(overrides: Partial<AppReleaseNotice> = {}): AppReleaseNotice {
  return {
    version: "1.66.0",
    summary: { date: "2026-10-10", counts: counts({ add: 1, fix: 1 }) },
    changelogUrl: CHANGELOG_URL,
    ...overrides,
  };
}

function only(data: ComponentsData): ComponentContainer {
  const [node] = data.components;
  if (node.type !== "container") throw new Error("expected a container");
  return node;
}

function lines(data: ComponentsData): string[] {
  const [child] = only(data).components;
  if (child.type !== "text") throw new Error("expected a text block first");
  return child.content.split("\n");
}

describe("AppReleaseComponentPresets.live", () => {
  it("shows the version, the release date, and the counts per type", () => {
    const message = AppReleaseComponentPresets.live(input());

    expect(validateComponentsV2(message)).toBeNull();
    expect(only(message).accentColor).toBe(ComponentColors.Success);
    expect(lines(message)).toEqual([
      "### App v1.66.0 is live",
      "-# Released Oct 10, 2026",
      "**1** addition · **1** fix",
    ]);
  });

  it("pluralizes each type and lists them in a fixed order", () => {
    const message = AppReleaseComponentPresets.live(
      input({
        summary: {
          date: "2026-10-08",
          counts: counts({
            chore: 2,
            change: 1,
            tweak: 2,
            security: 1,
            remove: 3,
            refactor: 2,
            fix: 4,
            add: 5,
          }),
        },
      }),
    );

    expect(lines(message)[2]).toBe(
      "**5** additions · **4** fixes · **2** refactors · **3** removals · **1** security fix · **2** chores · **2** tweaks · **1** change",
    );
  });

  it("leaves the counts line out when the section has no entries", () => {
    const message = AppReleaseComponentPresets.live(
      input({ summary: { date: "2026-10-10", counts: counts() } }),
    );

    expect(lines(message)).toEqual([
      "### App v1.66.0 is live",
      "-# Released Oct 10, 2026",
    ]);
  });

  it("shows only the version when the changelog has no section for it", () => {
    const message = AppReleaseComponentPresets.live(input({ summary: null }));

    expect(validateComponentsV2(message)).toBeNull();
    expect(lines(message)).toEqual(["### App v1.66.0 is live"]);
  });

  it("ends in a link button to the changelog", () => {
    const { components } = buildComponentsMessage(
      AppReleaseComponentPresets.live(input()),
    );
    const container = components[0].toJSON() as {
      components: Array<{
        type: number;
        components?: Array<{ style: number; url: string; label: string }>;
      }>;
    };
    const row = container.components[container.components.length - 1];

    expect(row.type).toBe(ComponentType.ActionRow);
    expect(row.components).toEqual([
      expect.objectContaining({
        style: ButtonStyle.Link,
        url: CHANGELOG_URL,
        label: "View changelog",
      }),
    ]);
  });
});
