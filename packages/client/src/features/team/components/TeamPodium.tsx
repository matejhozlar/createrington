import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { TeamMemberCard } from "./TeamMemberCard";
import { PODIUM, TEAM_SIZE } from "../data";
import { fx } from "../effects/core/fx-layer";
import { stage } from "../effects/core/stage";
import { preloadEffectSkins } from "../effects/registry";

type PodiumLayout = "row" | "stacked" | "compact";

const ROW_MIN_WIDTH = 902;
const STACKED_MIN_WIDTH = 512;

const TWO_ROWS =
  "grid grid-cols-[auto_auto] items-end justify-center [grid-template-areas:'center_center'_'left_right']";

const LAYOUTS: Record<PodiumLayout, { stage: string; group: string }> = {
  row: {
    stage: "mx-auto flex max-w-[974px] items-end justify-between",
    group: "contents",
  },
  stacked: {
    stage: cn(TWO_ROWS, "gap-x-6 gap-y-8"),
    group: "flex items-end gap-6",
  },
  compact: {
    stage: cn(TWO_ROWS, "gap-x-2 gap-y-4"),
    group: "flex items-end gap-2",
  },
};

const GROUPS = [
  {
    key: "left",
    members: PODIUM.left,
    offset: 0,
    className: "justify-self-end [grid-area:left]",
  },
  {
    key: "center",
    members: PODIUM.center,
    offset: PODIUM.left.length,
    className: "justify-self-center [grid-area:center]",
  },
  {
    key: "right",
    members: PODIUM.right,
    offset: PODIUM.left.length + PODIUM.center.length,
    className: "justify-self-start [grid-area:right]",
  },
] as const;

function layoutFor(width: number): PodiumLayout {
  if (width >= ROW_MIN_WIDTH) return "row";
  return width >= STACKED_MIN_WIDTH ? "stacked" : "compact";
}

function usePodiumLayout(
  ref: RefObject<HTMLDivElement | null>,
): PodiumLayout | null {
  const [layout, setLayout] = useState<PodiumLayout | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setLayout(layoutFor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return layout;
}

export function TeamPodium() {
  const stageRef = useRef<HTMLDivElement>(null);
  const layout = usePodiumLayout(stageRef);

  useEffect(() => {
    stage.root = stageRef.current;
    preloadEffectSkins();
    return () => {
      stage.root = null;
      stage.reset();
      fx.clear();
    };
  }, []);

  return (
    <div ref={stageRef}>
      {layout && (
        <div className={LAYOUTS[layout].stage}>
          {GROUPS.map((group) => (
            <div
              key={group.key}
              className={cn(LAYOUTS[layout].group, group.className)}
            >
              {group.members.map((member, position) => (
                <TeamMemberCard
                  key={member.uuid}
                  member={member}
                  index={group.offset + position}
                  total={TEAM_SIZE}
                  compact={layout === "compact"}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
