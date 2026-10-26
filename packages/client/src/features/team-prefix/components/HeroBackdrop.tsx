import { cn } from "@/lib/utils";

const BACKDROP_SRC = "/assets/hero/mountains-train-station.webp";

export function HeroBackdrop({ overlays }: { overlays: readonly string[] }) {
  return (
    <>
      <img
        src={BACKDROP_SRC}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] max-w-none object-cover blur-[6px] brightness-[0.32] saturate-[0.7]"
      />
      {overlays.map((overlay) => (
        <div
          key={overlay}
          aria-hidden
          className={cn("absolute inset-0", overlay)}
        />
      ))}
    </>
  );
}
