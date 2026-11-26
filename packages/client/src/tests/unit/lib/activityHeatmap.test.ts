import { describe, expect, it } from "vitest";
import { buildHeatmapGrid } from "@/lib/activityHeatmap";

describe("buildHeatmapGrid", () => {
  it("lays the grid out around the server's day, not the viewer's", () => {
    const { weeks } = buildHeatmapGrid(
      { "2026-11-26": 3600, "2026-11-20": 60 },
      2,
      "2026-11-26",
    );
    const days = weeks.flat();

    expect(days[0].date).toBe("2026-11-16");
    expect(days[days.length - 1].date).toBe("2026-11-29");
    expect(days.find((day) => day.date === "2026-11-26")).toEqual({
      date: "2026-11-26",
      seconds: 3600,
      future: false,
    });
    expect(days.find((day) => day.date === "2026-11-27")?.future).toBe(true);
    expect(days.reduce((sum, day) => sum + day.seconds, 0)).toBe(3660);
  });
});
