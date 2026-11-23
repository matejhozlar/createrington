import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { formatDate, formatMoney } from "@createrington/shared/format";
import { LoadingScreen } from "@/components/query-states";
import { RenderFrame } from "./components/RenderFrame";
import { RenderTeamTag } from "./components/RenderTeamTag";
import { RenderUnavailable } from "./components/RenderUnavailable";
import { useRenderData } from "./hooks/use-render-data";
import { useRenderPlatesReady } from "./hooks/use-render-plates";
import { loadSkin, randomPose } from "./skin-utils";

function winner(a: number, b: number): 0 | 1 | 2 {
  if (a > b) return 1;
  if (b > a) return 2;
  return 0;
}

function StatRow({
  label,
  value1,
  value2,
  win,
}: {
  label: string;
  value1: string;
  value2: string;
  win: 0 | 1 | 2;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2 rounded-md bg-card/60 border border-border">
      <span
        className={cn(
          "text-left text-[15px] font-semibold",
          win === 1 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {value1}
      </span>
      <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/50 whitespace-nowrap">
        {label}
      </span>
      <span
        className={cn(
          "text-right text-[15px] font-semibold",
          win === 2 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {value2}
      </span>
    </div>
  );
}

export function CompareRender() {
  const { data, unavailable } = useRenderData("compare", [
    "player1",
    "player2",
  ]);
  const [skinLeft, setSkinLeft] = useState<string | null>(null);
  const [skinRight, setSkinRight] = useState<string | null>(null);
  const [poseLeft] = useState(randomPose);
  const [poseRight] = useState(randomPose);
  const platesReady = useRenderPlatesReady();

  useEffect(() => {
    if (!data) return;
    void loadSkin(data.player1.uuid, poseLeft).then(setSkinLeft);
    void loadSkin(data.player2.uuid, poseRight).then(setSkinRight);
  }, [data, poseLeft, poseRight]);

  if (unavailable) return <RenderUnavailable reason={unavailable} />;
  if (!data || !skinLeft || !skinRight || !platesReady) {
    return <LoadingScreen />;
  }

  const left = data.player1;
  const right = data.player2;

  const networthWin = winner(
    parseFloat(left.networth.replace(/,/g, "")),
    parseFloat(right.networth.replace(/,/g, "")),
  );
  const playtimeWin = winner(left.playtimeSeconds, right.playtimeSeconds);
  const sessionsWin = winner(left.sessions, right.sessions);
  const memberWin = winner(
    new Date(right.memberSince).getTime(),
    new Date(left.memberSince).getTime(),
  );

  return (
    <RenderFrame
      id="compare-container"
      banner={{
        src: "/assets/render/player-comparison.webp",
        alt: "Player Comparison",
      }}
      glows={[
        "-left-20 top-8 h-[350px] w-[350px] bg-chart-1 opacity-20",
        "-right-20 bottom-8 h-[350px] w-[350px] bg-chart-5 opacity-20",
      ]}
    >
      <div className="flex-1 flex items-center justify-center px-6 pt-2 z-10">
        <div className="flex flex-col items-center w-[200px] shrink-0">
          <div className="relative h-[300px] flex items-end justify-center">
            <div className="absolute bottom-0 w-40 h-40 rounded-full blur-[60px] opacity-40 bg-chart-1" />
            <img
              src={skinLeft}
              alt={left.username}
              className="relative h-[280px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            />
          </div>
          <div className="mt-2 flex flex-col items-center gap-1.5">
            <RenderTeamTag code={left.tagCode} height={18} />
            <span className="text-xl font-bold tracking-wide text-chart-1">
              {left.username}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-3 px-2">
          <span className="text-2xl font-bold tracking-[0.15em] text-foreground/10">
            VS
          </span>
          <div className="flex flex-col gap-2.5 w-full">
            <StatRow
              label="NETWORTH"
              value1={formatMoney(Number(left.networth))}
              value2={formatMoney(Number(right.networth))}
              win={networthWin}
            />
            <StatRow
              label="PLAYTIME"
              value1={left.playtime}
              value2={right.playtime}
              win={playtimeWin}
            />
            <StatRow
              label="SESSIONS"
              value1={left.sessions.toLocaleString()}
              value2={right.sessions.toLocaleString()}
              win={sessionsWin}
            />
            <StatRow
              label="MEMBER SINCE"
              value1={formatDate(left.memberSince)}
              value2={formatDate(right.memberSince)}
              win={memberWin}
            />
          </div>
        </div>

        <div className="flex flex-col items-center w-[200px] shrink-0">
          <div className="relative h-[300px] flex items-end justify-center">
            <div className="absolute bottom-0 w-40 h-40 rounded-full blur-[60px] opacity-40 bg-chart-5" />
            <img
              src={skinRight}
              alt={right.username}
              className="relative h-[280px] -scale-x-100 drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            />
          </div>
          <div className="mt-2 flex flex-col items-center gap-1.5">
            <RenderTeamTag code={right.tagCode} height={18} />
            <span className="text-xl font-bold tracking-wide text-chart-5">
              {right.username}
            </span>
          </div>
        </div>
      </div>
    </RenderFrame>
  );
}
