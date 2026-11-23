import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/use-countdown";
import { sortByWeight, sumBoosts } from "@/features/structure-packs/pool";

export function OverlayHero() {
  const { data: pool } = useQuery(
    trpc.public.structurePacks.pool.queryOptions(),
  );
  const { data: rotationInfo } = useQuery(
    trpc.public.structurePacks.rotationInfo.queryOptions(),
  );

  const countdown =
    useCountdown(rotationInfo?.nextRotationAt ?? null) ??
    (rotationInfo?.enabled === false ? "Paused" : "–");
  const leader = sortByWeight(pool)[0];

  return (
    <div className="flex flex-col gap-6 px-10 pb-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
      <h1 className="min-w-0 text-[40px] font-semibold leading-[1.05] tracking-[-0.02em]">
        Shape the next world.
      </h1>
      <div className="flex shrink-0 flex-wrap items-stretch gap-x-6 gap-y-4">
        <div className="hidden lg:contents">
          <MiniStat label="Leading" value={leader?.pack.name ?? "–"} accent />
          <div className="w-px bg-white/10" />
        </div>
        <MiniStat label="Rotation in" value={countdown} mono />
        <div className="w-px bg-white/10" />
        <MiniStat label="Total boosts" value={`${sumBoosts(pool)}`} mono />
      </div>
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}

function MiniStat({ label, value, mono, accent }: MiniStatProps) {
  return (
    <div className="flex min-w-0 flex-col justify-end">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-[15px] font-semibold",
          mono && "font-mono tabular-nums",
          accent ? "text-blue-bright" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}
