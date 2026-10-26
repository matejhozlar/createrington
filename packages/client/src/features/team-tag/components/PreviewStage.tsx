import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { HeroBackdrop } from "./HeroBackdrop";

export type StageMode = "close" | "tab";

const STAGE_MODES = [
  { value: "close", label: "Close up" },
  { value: "tab", label: "Tab list" },
] as const satisfies readonly { value: StageMode; label: string }[];

const STAGE_OVERLAYS = [
  "bg-linear-to-t from-background from-[4%] to-transparent to-50%",
  "bg-linear-to-b from-background to-transparent to-40%",
];

export function PreviewStage({
  wide,
  mode,
  onModeChange,
  closeUp,
  tabList,
  settings,
}: {
  wide: boolean;
  mode: StageMode;
  onModeChange: (mode: StageMode) => void;
  closeUp: ReactNode;
  tabList: ReactNode;
  settings: ReactNode;
}) {
  const showCloseUp = wide || mode === "close";
  const showTabList = wide || mode === "tab";

  return (
    <section
      className={cn(
        "overflow-hidden bg-background",
        wide
          ? "relative rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
          : "relative h-[296px]",
      )}
    >
      <HeroBackdrop overlays={STAGE_OVERLAYS} />
      {wide ? (
        <div className="relative px-6 pt-[18px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview
          </span>
        </div>
      ) : (
        <div className="relative flex items-center justify-between gap-3 px-5 pt-3.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Team tag
          </h1>
          <Tabs
            value={mode}
            onValueChange={(next) => onModeChange(next as StageMode)}
          >
            <TabsList>
              {STAGE_MODES.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="cursor-pointer text-foreground/80"
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}
      {showCloseUp && (
        <div className={cn("relative", wide ? "pt-9 pb-[26px]" : "pt-10")}>
          {closeUp}
        </div>
      )}
      {showTabList && tabList}
      {wide && (
        <div className="relative border-t bg-card px-6 pt-3.5 pb-[18px]">
          {settings}
        </div>
      )}
    </section>
  );
}
