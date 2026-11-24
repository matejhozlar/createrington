import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sentJson, requestedUrl } from "@/tests/helpers/fetch";

const fetchMock = vi.fn<typeof fetch>();

const board = vi.hoisted(() => ({
  subcategories: [
    { id: 10, category: "modpack", name: "Economy", position: 0 },
    { id: 20, category: "website", name: "Launcher", position: 0 },
  ],
  items: [
    {
      id: 7,
      title: "Give money a purpose",
      body: "x".repeat(500),
      status: "open",
    },
  ],
  filings: new Map([[7, { categories: ["modpack"], subcategoryIds: [10] }]]),
  createItem: vi.fn(),
  createComment: vi.fn(),
}));

vi.mock("@/config", () => ({
  default: {
    adminChat: {
      url: "http://claude-automation.test",
      secret: "s".repeat(32),
    },
    meta: { links: { website: "https://createrington.test/" } },
  },
}));

vi.mock("@/db", () => ({
  planningRepo: { createItem: board.createItem },
  Q: {
    planning: {
      subcategory: {
        findAll: async (filters: {
          id?: { $in: number[] };
          category?: { $in: string[] };
        }) =>
          board.subcategories.filter(
            (s) =>
              (!filters.id || filters.id.$in.includes(s.id)) &&
              (!filters.category || filters.category.$in.includes(s.category)),
          ),
      },
      item: {
        findAll: async () => board.items,
        getFilings: async () => board.filings,
        get: async ({ id }: { id: number }) => {
          const item = board.items.find((i) => i.id === id);
          if (!item) throw new Error("planning_item not found");
          return item;
        },
        comment: { create: board.createComment },
      },
    },
  },
}));

const { planningIntakeService } =
  await import("@/services/planning-intake/planning-intake.service");

const SOURCE = "https://discord.com/channels/1/2/3";
const by = { discordId: "555", sourceUrl: SOURCE };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  board.createItem.mockReset();
  board.createItem.mockImplementation(async (content: { title: string }) => ({
    id: 31,
    title: content.title,
  }));
  board.createComment.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PlanningIntakeService.start", () => {
  it("sends the discussion together with the board Claude has to match against", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ sessionId: 4 })),
    );

    await expect(
      planningIntakeService.start({
        transcript: "we should rework the shops",
        messageCount: 1,
        requestedBy: "matej",
        sourceLabel: "#staff",
      }),
    ).resolves.toEqual({ sessionId: 4 });

    expect(requestedUrl(fetchMock).href).toBe(
      "http://claude-automation.test/api/planning",
    );
    const sent = sentJson(fetchMock) as {
      transcript: string;
      categories: { key: string; subcategories: unknown[] }[];
      cards: { details: string }[];
    };
    expect(sent.transcript).toBe("we should rework the shops");
    expect(sent.categories.map((c) => c.key)).toEqual([
      "modpack",
      "website",
      "discord",
      "server",
    ]);
    expect(sent.categories[0].subcategories).toEqual([
      { id: 10, name: "Economy" },
    ]);
    expect(sent.cards).toEqual([
      {
        id: 7,
        title: "Give money a purpose",
        categories: ["modpack"],
        subcategories: ["Economy"],
        status: "open",
        details: "x".repeat(300),
      },
    ]);
  });
});

describe("PlanningIntakeService.apply", () => {
  it("adds a new item as a draft with the link back to Discord", async () => {
    const saved = await planningIntakeService.apply(
      {
        action: "create",
        title: "Rework the shops",
        body: "Shops should sell claim upgrades.",
        categories: ["modpack", "website"],
        subcategoryIds: [10, 20],
      },
      by,
    );

    expect(board.createItem).toHaveBeenCalledWith(
      {
        title: "Rework the shops",
        body: "Shops should sell claim upgrades.",
        categories: ["modpack", "website"],
        subcategoryIds: [10, 20],
        status: "draft",
      },
      "555",
      { sourceUrl: SOURCE },
    );
    expect(saved).toEqual({
      kind: "created",
      itemId: 31,
      title: "Rework the shops",
      url: "https://createrington.test/admin/planning/31",
    });
  });

  it("leaves out unknown categories and subcategories outside the chosen ones", async () => {
    await planningIntakeService.apply(
      {
        action: "create",
        title: "Rework the shops",
        body: "Shops should sell claim upgrades.",
        categories: ["modpack", "economy"],
        subcategoryIds: [10, 20],
      },
      by,
    );

    expect(board.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ["modpack"],
        subcategoryIds: [10],
      }),
      "555",
      { sourceUrl: SOURCE },
    );
  });

  it("applies the website's input rules to a proposed card", async () => {
    await planningIntakeService.apply(
      {
        action: "create",
        title: "  Rework the shops  ",
        body: "   ",
        categories: ["modpack"],
        subcategoryIds: [],
      },
      by,
    );

    expect(board.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rework the shops", body: null }),
      "555",
      { sourceUrl: SOURCE },
    );
  });

  it("refuses a card without a title", async () => {
    await expect(
      planningIntakeService.apply(
        {
          action: "create",
          title: "   ",
          body: "Shops should sell claim upgrades.",
          categories: ["modpack"],
          subcategoryIds: [],
        },
        by,
      ),
    ).rejects.toThrow("The proposed title is empty");
    expect(board.createItem).not.toHaveBeenCalled();
  });

  it("refuses an empty comment", async () => {
    await expect(
      planningIntakeService.apply(
        { action: "comment", cardId: 7, cardTitle: "Any", body: "  " },
        by,
      ),
    ).rejects.toThrow("The proposed comment is empty");
    expect(board.createComment).not.toHaveBeenCalled();
  });

  it("refuses a card with no category the board has", async () => {
    await expect(
      planningIntakeService.apply(
        {
          action: "create",
          title: "Rework the shops",
          body: "Shops should sell claim upgrades.",
          categories: ["economy"],
          subcategoryIds: [],
        },
        by,
      ),
    ).rejects.toThrow('Unknown planning categories "economy"');
    expect(board.createItem).not.toHaveBeenCalled();
  });

  it("comments on the existing card as the admin who ran the command", async () => {
    const saved = await planningIntakeService.apply(
      {
        action: "comment",
        cardId: 7,
        cardTitle: "Give money a purpose",
        body: "Agreed that shops sell claim upgrades.",
      },
      by,
    );

    expect(board.createComment).toHaveBeenCalledWith({
      itemId: 7,
      authorDiscordId: "555",
      body: "Agreed that shops sell claim upgrades.",
      sourceUrl: SOURCE,
    });
    expect(saved).toMatchObject({
      kind: "commented",
      itemId: 7,
      title: "Give money a purpose",
    });
  });

  it("fails when the card it should comment on is gone", async () => {
    await expect(
      planningIntakeService.apply(
        { action: "comment", cardId: 99, cardTitle: "Gone", body: "More." },
        by,
      ),
    ).rejects.toThrow();
    expect(board.createComment).not.toHaveBeenCalled();
  });
});
