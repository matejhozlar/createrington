import { useState } from "react";
import { Blocks, LogIn, Rocket, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { BoostDialog } from "@/features/structure-packs/components/BoostDialog";
import { PackModsDialog } from "@/features/structure-packs/components/PackModsDialog";
import { weightShare } from "@/features/structure-packs/pool";
import type { PoolEntry } from "@/features/structure-packs/types";

interface PackRowProps {
  entry: PoolEntry;
  totalWeight: number;
  myBoostUnits: number;
  boostUnitPrice: number;
  rank: number;
  rotationPaused: boolean;
}

export function PackRow({
  entry: { pack, weight, boostUnits },
  totalWeight,
  myBoostUnits,
  boostUnitPrice,
  rank,
  rotationPaused,
}: PackRowProps) {
  const { user, login } = useAuth();
  const [boostOpen, setBoostOpen] = useState(false);
  const [modsOpen, setModsOpen] = useState(false);
  const modCount = pack.mods.length;
  const probability = weightShare(weight, totalWeight);

  return (
    <>
      <div className="group relative flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-blue/40 hover:bg-white/[0.04]">
        {rank === 1 && (
          <div className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full border border-blue/40 bg-black px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-blue-bright lg:hidden">
            <TrendingUp className="size-2.5" />
            Leading
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              {String(rank).padStart(2, "0")}
            </div>
            <h3 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">
              {pack.name}
            </h3>
            {pack.description && (
              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/50">
                {pack.description}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[28px] font-semibold leading-none tabular-nums text-white">
              {probability}
              <span className="align-top text-[16px] text-blue-bright">%</span>
            </div>
          </div>
        </div>

        <div className="h-[3px] overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-blue-bright"
            style={{ width: `${probability}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/45">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Blocks className="size-3" />
              {modCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Rocket className="size-3" />
              {boostUnits}
            </span>
            {myBoostUnits > 0 && (
              <span className="inline-flex items-center gap-1 text-blue-bright">
                +{myBoostUnits} yours
              </span>
            )}
          </div>
          <span className="font-mono tabular-nums text-white/35">
            w {weight.toFixed(2)}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setModsOpen(true)}
            disabled={modCount === 0}
            className="flex-1 rounded-md border border-white/10 px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:border-white/25 hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-50"
          >
            Inspect
          </button>
          {rotationPaused ? (
            <button
              type="button"
              disabled
              className="flex-1 rounded-md border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/40 disabled:pointer-events-none"
            >
              Rotations paused
            </button>
          ) : user ? (
            <button
              type="button"
              onClick={() => setBoostOpen(true)}
              className="flex-1 rounded-md bg-blue px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-blue-bright"
            >
              Boost
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void login()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-blue px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-blue-bright"
            >
              <LogIn className="size-3" />
              Log in to boost
            </button>
          )}
        </div>
      </div>

      <PackModsDialog
        open={modsOpen}
        onOpenChange={setModsOpen}
        packName={pack.name}
        mods={pack.mods}
      />

      <BoostDialog
        open={boostOpen}
        onOpenChange={setBoostOpen}
        packId={pack.id}
        packName={pack.name}
        boostUnitPrice={boostUnitPrice}
      />
    </>
  );
}
