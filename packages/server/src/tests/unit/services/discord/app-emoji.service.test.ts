import { describe, it, expect, vi, beforeEach } from "vitest";
import { Collection, type Client } from "discord.js";
import { AppEmojiService } from "@/services/discord/emojis";
import { APP_EMOJI_KEYS } from "@/discord/emojis";

const readFile = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", () => ({ default: { readFile } }));

interface FakeEmoji {
  id: string;
  name: string;
  animated: boolean;
  toString(): string;
  imageURL(): string;
}

function fakeEmoji(name: string, id: string): FakeEmoji {
  return {
    id,
    name,
    animated: false,
    toString: () => `<:${name}:${id}>`,
    imageURL: () => `https://cdn.discordapp.com/emojis/${id}.webp`,
  };
}

function fakeClient(existing: FakeEmoji[]) {
  const store = new Map(existing.map((emoji) => [emoji.id, emoji]));
  let nextId = 1000;
  const emojis = {
    fetch: vi.fn(async () => new Collection(store)),
    create: vi.fn(async ({ name }: { name: string }) => {
      const created = fakeEmoji(name, String(nextId++));
      store.set(created.id, created);
      return created;
    }),
    delete: vi.fn(async (emoji: FakeEmoji) => {
      store.delete(emoji.id);
    }),
  };
  const client = { application: { emojis } } as unknown as Client;
  return { client, emojis };
}

beforeEach(() => {
  readFile.mockReset();
  readFile.mockResolvedValue(Buffer.from("png"));
});

describe("AppEmojiService.sync", () => {
  it("uploads the manifest emojis the application lacks and keeps the rest", async () => {
    const { client, emojis } = fakeClient([fakeEmoji("check", "1")]);
    const service = new AppEmojiService(client);

    const result = await service.sync();

    expect(result.kept).toEqual(["check"]);
    expect(result.created).toEqual(
      APP_EMOJI_KEYS.filter((key) => key !== "check"),
    );
    expect(result.failed).toEqual([]);
    expect(emojis.delete).not.toHaveBeenCalled();
    expect(service.token("check")).toBe("<:check:1>");
    expect(service.list().map((emoji) => emoji.key)).toEqual(APP_EMOJI_KEYS);
  });

  it("re-uploads manifest emojis the application already has with replace", async () => {
    const existing = fakeEmoji("check", "1");
    const { client, emojis } = fakeClient([existing]);
    const service = new AppEmojiService(client);

    const result = await service.sync({ replace: true });

    expect(result.replaced).toEqual(["check"]);
    expect(result.kept).toEqual([]);
    expect(emojis.delete).toHaveBeenCalledWith(existing);
    expect(service.token("check")).toBe("<:check:1000>");
  });

  it("deletes emojis outside the manifest only with prune", async () => {
    const stray = fakeEmoji("old_thing", "9");
    const { client, emojis } = fakeClient([stray]);
    const service = new AppEmojiService(client);

    await service.sync();
    expect(emojis.delete).not.toHaveBeenCalled();

    const result = await service.sync({ prune: true });
    expect(result.pruned).toEqual(["old_thing"]);
    expect(emojis.delete).toHaveBeenCalledWith(stray);
  });

  it("records a prune delete that fails and keeps deleting the rest", async () => {
    const first = fakeEmoji("old_thing", "9");
    const second = fakeEmoji("older_thing", "8");
    const { client, emojis } = fakeClient([first, second]);
    emojis.delete.mockImplementationOnce(async () => {
      throw new Error("403");
    });
    const service = new AppEmojiService(client);

    const result = await service.sync({ prune: true });

    expect(result.pruneFailed).toEqual(["old_thing"]);
    expect(result.pruned).toEqual(["older_thing"]);
    expect(result.created).toEqual(APP_EMOJI_KEYS);
  });

  it("records an upload that fails and leaves that emoji out of tokens and listings", async () => {
    readFile.mockImplementation(async (file: string) => {
      if (String(file).endsWith("check.png")) {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      }
      return Buffer.from("png");
    });
    const { client } = fakeClient([]);
    const service = new AppEmojiService(client);

    const result = await service.sync();

    expect(result.failed).toEqual(["check"]);
    expect(service.token("check")).toBe("");
    expect(service.list().map((emoji) => emoji.key)).toEqual(
      APP_EMOJI_KEYS.filter((key) => key !== "check"),
    );
  });
});

describe("AppEmojiService.list", () => {
  it("describes each uploaded emoji with its token parts and image url", async () => {
    const { client } = fakeClient([fakeEmoji("check", "1")]);
    const service = new AppEmojiService(client);

    await service.sync();

    expect(service.list()[0]).toEqual({
      key: "check",
      name: "check",
      id: "1",
      animated: false,
      url: "https://cdn.discordapp.com/emojis/1.webp",
    });
  });
});
