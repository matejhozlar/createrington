export const STAT_CATEGORY_LABELS: Record<string, string> = {
  "minecraft:mined": "Mined",
  "minecraft:used": "Used",
  "minecraft:crafted": "Crafted",
  "minecraft:broken": "Broken",
  "minecraft:picked_up": "Picked up",
  "minecraft:dropped": "Dropped",
  "minecraft:killed": "Killed",
  "minecraft:killed_by": "Killed by",
  "minecraft:custom": "General",
};

export type StatUnit = "count" | "distance" | "time" | "damage";

const TIME_STATS = new Set([
  "minecraft:play_time",
  "minecraft:total_world_time",
  "minecraft:time_since_death",
  "minecraft:time_since_rest",
  "minecraft:sneak_time",
]);

const DISTANCE_NAMES: Record<string, string> = {
  aviate: "Elytra",
  walk_under_water: "Walked underwater",
  walk_on_water: "Walked on water",
};

function titleCase(words: string): string {
  return words.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function splitKey(key: string): { namespace: string; path: string } {
  const index = key.indexOf(":");
  return index === -1
    ? { namespace: "minecraft", path: key }
    : { namespace: key.slice(0, index), path: key.slice(index + 1) };
}

/** The mod a stat item belongs to, as a readable name, or null for vanilla. */
export function statModName(item: string): string | null {
  const { namespace } = splitKey(item);
  return namespace === "minecraft" ? null : titleCase(namespace);
}

/** "minecraft:mined" -> "Mined"; unknown categories are title-cased. */
export function formatStatCategory(category: string): string {
  return STAT_CATEGORY_LABELS[category] ?? titleCase(splitKey(category).path);
}

/** How a stat's raw value is measured: plain count, centimetres, ticks or tenths of health. */
export function statUnit(category: string, item: string): StatUnit {
  if (category !== "minecraft:custom") return "count";
  if (item.endsWith("_one_cm")) return "distance";
  if (TIME_STATS.has(item)) return "time";
  if (splitKey(item).path.startsWith("damage_")) return "damage";
  return "count";
}

/** "minecraft:deepslate_diamond_ore" -> "Deepslate Diamond Ore", "minecraft:walk_one_cm" -> "Walk distance". */
export function formatStatItem(category: string, item: string): string {
  const { path } = splitKey(item);
  if (statUnit(category, item) === "distance") {
    const base = path.replace(/_one_cm$/, "");
    return `${DISTANCE_NAMES[base] ?? titleCase(base)} distance`;
  }
  return titleCase(path);
}

/** Formats a raw stat value in its unit: 342, 12.4 km, 38 h, 210 hearts. */
export function formatStatValue(
  category: string,
  item: string,
  value: number,
): string {
  switch (statUnit(category, item)) {
    case "distance": {
      const metres = value / 100;
      return metres >= 1000
        ? `${(metres / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} km`
        : `${Math.round(metres).toLocaleString("en-US")} m`;
    }
    case "time": {
      const hours = value / 20 / 3600;
      return hours >= 1
        ? `${Math.floor(hours).toLocaleString("en-US")} h`
        : `${Math.round(hours * 60)} min`;
    }
    case "damage":
      return `${Math.round(value / 20).toLocaleString("en-US")} hearts`;
    case "count":
      return value.toLocaleString("en-US");
  }
}
