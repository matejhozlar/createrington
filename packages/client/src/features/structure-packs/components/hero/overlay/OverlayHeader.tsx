import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

interface OverlayHeaderProps {
  onClose: () => void;
}

export function OverlayHeader({ onClose }: OverlayHeaderProps) {
  const { data: rotationInfo } = useQuery(
    trpc.public.structurePacks.rotationInfo.queryOptions(),
  );

  const label =
    rotationInfo?.enabled === false
      ? "Paused"
      : rotationInfo?.cycle != null
        ? `Cycle ${rotationInfo.cycle}`
        : "Cycle";

  return (
    <header className="flex items-center justify-between px-10 pt-7 pb-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/55">
        {label}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit portal"
        className="group grid size-8 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="close-turn size-4 group-hover:[--close-turn:90deg]" />
      </button>
    </header>
  );
}
