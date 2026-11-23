import { RenderFrame } from "./components/RenderFrame";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { formatDate, formatMoney } from "@createrington/shared/format";
import { LoadingScreen } from "@/components/query-states";
import { RenderTeamTag } from "./components/RenderTeamTag";
import { RenderUnavailable } from "./components/RenderUnavailable";
import { useRenderData } from "./hooks/use-render-data";
import { useRenderPlatesReady } from "./hooks/use-render-plates";
import { loadSkin, randomPose } from "./skin-utils";

interface ProfileData {
  username: string;
  uuid: string;
  online: boolean;
  cashBalance: string;
  playtime: string;
  playtimeSeconds: number;
  sessions: number;
  memberSince: string;
  blocksMined: number;
  mobsKilled: number;
  deaths: number;
  distanceKm: number;
  tagCode: string | null;
}

function StatPill({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border border-border bg-card/60 px-4 py-2.5",
        className,
      )}
    >
      <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/50">
        {label}
      </span>
      <span className="text-[15px] font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function ProfileRender() {
  const { data, unavailable } = useRenderData<ProfileData>("profile", [
    "player",
  ]);
  const [skinSrc, setSkinSrc] = useState<string | null>(null);
  const [pose] = useState(randomPose);
  const platesReady = useRenderPlatesReady();

  useEffect(() => {
    if (!data) return;
    void loadSkin(data.uuid, pose).then(setSkinSrc);
  }, [data, pose]);

  if (unavailable) return <RenderUnavailable reason={unavailable} />;
  if (!data || !skinSrc || !platesReady) return <LoadingScreen />;

  return (
    <RenderFrame
      id="profile-container"
      banner={{
        src: "/assets/render/player-profile.webp",
        alt: "Player Profile",
      }}
      glows={[
        "-left-16 top-12 h-[320px] w-[320px] bg-chart-1 opacity-20",
        "-right-16 -bottom-8 h-[280px] w-[280px] bg-chart-3 opacity-15",
      ]}
    >
      <div className="flex-1 flex items-center px-6 pt-1 z-10">
        <div className="flex flex-col items-center w-[300px] shrink-0">
          <div className="relative h-[380px] flex items-end justify-center">
            <div className="absolute bottom-2 w-36 h-36 rounded-full blur-[60px] opacity-40 bg-chart-1" />
            <img
              src={skinSrc}
              alt={data.username}
              className="relative h-[340px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-2.5 pl-2 pr-4">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-3">
              <RenderTeamTag code={data.tagCode} height={22} inline />
              <h2 className="text-2xl font-bold tracking-wide text-foreground">
                {data.username}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  data.online
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                    : "bg-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-semibold tracking-wide uppercase",
                  data.online ? "text-emerald-400" : "text-muted-foreground/40",
                )}
              >
                {data.online ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <StatPill
              label="Balance"
              value={formatMoney(Number(data.cashBalance))}
            />
            <StatPill label="Playtime" value={data.playtime} />
            <StatPill label="Sessions" value={data.sessions.toLocaleString()} />
            <StatPill
              label="Member Since"
              value={formatDate(data.memberSince)}
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <StatPill
              label="Blocks Mined"
              value={data.blocksMined.toLocaleString()}
            />
            <StatPill
              label="Mobs Killed"
              value={data.mobsKilled.toLocaleString()}
            />
            <StatPill label="Deaths" value={data.deaths.toLocaleString()} />
            <StatPill
              label="Traveled"
              value={`${data.distanceKm.toLocaleString()} km`}
            />
          </div>
        </div>
      </div>
    </RenderFrame>
  );
}
