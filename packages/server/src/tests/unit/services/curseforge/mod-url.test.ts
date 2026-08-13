import { describe, it, expect } from "vitest";
import { parseModUrl } from "@/services/curseforge/mod-url";

describe("parseModUrl", () => {
  it("parses a canonical mod page URL", () => {
    expect(
      parseModUrl("https://www.curseforge.com/minecraft/mc-mods/jei"),
    ).toEqual({ ok: true, slug: "jei" });
  });

  it("accepts the bare curseforge.com host", () => {
    expect(
      parseModUrl("https://curseforge.com/minecraft/mc-mods/create"),
    ).toEqual({ ok: true, slug: "create" });
  });

  it("accepts a scheme-less link", () => {
    expect(parseModUrl("www.curseforge.com/minecraft/mc-mods/jei")).toEqual({
      ok: true,
      slug: "jei",
    });
  });

  it("ignores trailing path segments, query, and hash", () => {
    expect(
      parseModUrl(
        "https://www.curseforge.com/minecraft/mc-mods/jei/files/1234?page=2#comments",
      ),
    ).toEqual({ ok: true, slug: "jei" });
  });

  it("normalizes host and slug casing", () => {
    expect(
      parseModUrl("HTTPS://WWW.CurseForge.com/minecraft/mc-mods/JEI"),
    ).toEqual({ ok: true, slug: "jei" });
  });

  it("trims surrounding whitespace", () => {
    expect(
      parseModUrl("  https://www.curseforge.com/minecraft/mc-mods/jei  "),
    ).toEqual({ ok: true, slug: "jei" });
  });

  it("rejects non-CurseForge hosts", () => {
    expect(parseModUrl("https://modrinth.com/mod/sodium")).toEqual({
      ok: false,
      reason: "not-curseforge",
    });
  });

  it("rejects unparseable input", () => {
    expect(parseModUrl("not a url at all")).toEqual({
      ok: false,
      reason: "not-curseforge",
    });
  });

  it("rejects non-mod CurseForge pages", () => {
    expect(
      parseModUrl(
        "https://www.curseforge.com/minecraft/texture-packs/faithful-32x",
      ),
    ).toEqual({ ok: false, reason: "not-a-mod" });
    expect(
      parseModUrl(
        "https://www.curseforge.com/minecraft/modpacks/createrington",
      ),
    ).toEqual({ ok: false, reason: "not-a-mod" });
  });

  it("rejects a mods listing URL without a slug", () => {
    expect(parseModUrl("https://www.curseforge.com/minecraft/mc-mods")).toEqual(
      { ok: false, reason: "missing-slug" },
    );
  });
});
