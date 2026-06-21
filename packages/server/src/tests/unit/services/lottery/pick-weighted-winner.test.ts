import { describe, it, expect, vi, afterEach } from "vitest";
import { pickWeightedWinner } from "@/services/lottery/weighted-winner";
import type { LotteryParticipant } from "@/services/lottery/types";

function participant(name: string, amount: number): LotteryParticipant {
  return { minecraftUuid: name, minecraftUsername: name, amount };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickWeightedWinner", () => {
  const participants = [
    participant("alice", 10),
    participant("bob", 30),
    participant("carol", 60),
  ];

  it("selects the participant whose weight band contains the random draw", () => {
    // totalWeight = 100. random = 0.05 * 100 = 5 -> falls in alice's [0, 10) band.
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    expect(pickWeightedWinner(participants).minecraftUsername).toBe("alice");

    // random = 0.2 * 100 = 20 -> after subtracting alice(10) -> 10, then bob(30) -> -10 <= 0.
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    expect(pickWeightedWinner(participants).minecraftUsername).toBe("bob");

    // random = 0.9 * 100 = 90 -> only carol's band remains.
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(pickWeightedWinner(participants).minecraftUsername).toBe("carol");
  });

  it("weights selection by bet amount across many draws", () => {
    const counts: Record<string, number> = { alice: 0, bob: 0, carol: 0 };
    const draws = 100;
    let i = 0;
    // Sweep band centers across [0, 1) to avoid the inclusive boundary edge.
    vi.spyOn(Math, "random").mockImplementation(() => (i + 0.5) / draws);

    for (i = 0; i < draws; i++) {
      counts[pickWeightedWinner(participants).minecraftUsername]++;
    }

    // Bands are proportional to weight: alice 10%, bob 30%, carol 60%.
    expect(counts.alice).toBe(10);
    expect(counts.bob).toBe(30);
    expect(counts.carol).toBe(60);
  });

  it("returns the only participant when there is a single entry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickWeightedWinner([participant("solo", 5)]).minecraftUsername).toBe(
      "solo",
    );
  });
});
