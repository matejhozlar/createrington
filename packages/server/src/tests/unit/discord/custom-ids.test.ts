import { describe, it, expect } from "vitest";
import { CustomIds } from "@/discord/custom-ids";

const SAMPLE_VALUE = "1";

function sampleId(definition: (typeof CustomIds)[keyof typeof CustomIds]) {
  const values = new Proxy({}, { get: () => SAMPLE_VALUE });
  return (definition.build as (values?: unknown) => string)(values);
}

describe("CustomIds", () => {
  const entries = Object.entries(CustomIds);

  it.each(entries)("%s parses the id it builds", (_name, definition) => {
    expect(definition.matches(sampleId(definition))).toBe(true);
  });

  it.each(entries)(
    "%s is not claimed by any other definition",
    (name, definition) => {
      const id = sampleId(definition);
      const claimedBy = entries
        .filter(([other, def]) => other !== name && def.matches(id))
        .map(([other]) => other);

      expect(claimedBy).toEqual([]);
    },
  );
});
