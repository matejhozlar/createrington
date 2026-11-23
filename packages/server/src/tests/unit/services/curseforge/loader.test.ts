import { describe, it, expect } from "vitest";
import {
  CurseForgeLoader,
  loaderLabel,
  loaderTypeOf,
  parseLoaderId,
} from "@/services/curseforge/loader";

describe("parseLoaderId", () => {
  it("splits the loader id into name and exact version", () => {
    expect(parseLoaderId("neoforge-21.1.249")).toEqual({
      id: "neoforge-21.1.249",
      name: "neoforge",
      version: "21.1.249",
    });
  });

  it("keeps dashes inside the version", () => {
    expect(parseLoaderId("forge-47.2.0-beta")?.version).toBe("47.2.0-beta");
  });

  it("lowercases the name", () => {
    expect(parseLoaderId("NeoForge-21.1.249")?.name).toBe("neoforge");
  });

  it.each(["neoforge", "-21.1.249", "neoforge-", ""])(
    "rejects %j",
    (loaderId) => {
      expect(parseLoaderId(loaderId)).toBeNull();
    },
  );
});

describe("loaderTypeOf", () => {
  it.each([
    ["neoforge-21.1.249", CurseForgeLoader.neoforge],
    ["forge-47.2.0", CurseForgeLoader.forge],
    ["fabric-0.16.9", CurseForgeLoader.fabric],
    ["quilt-0.26.0", CurseForgeLoader.quilt],
  ])("reads %s as CurseForge loader %i", (loaderId, type) => {
    expect(loaderTypeOf(loaderId)).toBe(type);
  });

  it.each(["liteloader-1.12.2", "neoforge", ""])(
    "has no type for %j",
    (loaderId) => {
      expect(loaderTypeOf(loaderId)).toBeNull();
    },
  );
});

describe("loaderLabel", () => {
  it("names a known loader and keeps its version", () => {
    expect(loaderLabel("neoforge-21.1.172")).toBe("NeoForge 21.1.172");
  });

  it("keeps an unknown loader's name as written", () => {
    expect(loaderLabel("liteloader-1.12.2")).toBe("liteloader 1.12.2");
  });

  it("names a loader id that carries no version", () => {
    expect(loaderLabel("fabric")).toBe("Fabric");
  });
});
