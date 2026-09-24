import { useSearchParams } from "react-router";

const SIDE_KEYS = ["a", "b"] as const;

export type Side = 0 | 1;

export function useCompareParams() {
  const [params, setParams] = useSearchParams();
  const sides = SIDE_KEYS.map((key) => params.get(key) || null) as [
    string | null,
    string | null,
  ];

  const write = (next: [string | null, string | null]) =>
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        SIDE_KEYS.forEach((key, index) => {
          const value = next[index];
          if (value) updated.set(key, value);
          else updated.delete(key);
        });
        return updated;
      },
      { replace: true, preventScrollReset: true },
    );

  const pick = (side: Side, minecraftUsername: string) =>
    write(
      side === 0
        ? [minecraftUsername, sides[1]]
        : [sides[0], minecraftUsername],
    );
  const swap = () => write([sides[1], sides[0]]);

  return { sides, pick, swap };
}
