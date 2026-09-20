import { useEffect, useState } from "react";
import { formatDate } from "@createrington/shared/format";
import { LoadingScreen } from "@/components/loading-spinner";
import { formatMoney } from "@/lib/format";
import { mcHeadsBody } from "@/lib/external-urls";
import { RenderNotFound } from "./components/RenderNotFound";
import { useRenderData } from "./hooks/use-render-data";
import { randomPose, skinApiUrl } from "./skin-utils";

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
      className={`flex flex-col gap-1 rounded-md bg-card/60 border border-border px-4 py-2.5 ${className ?? ""}`}
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

  useEffect(() => {
    if (!data) return;

    const img = new Image();
    img.onload = () => setSkinSrc(img.src);
    img.onerror = () => setSkinSrc(mcHeadsBody(data.uuid));
    img.src = skinApiUrl(data.uuid, pose);
  }, [data, pose]);

  if (unavailable) return <RenderNotFound />;
  if (!data || !skinSrc) return <LoadingScreen />;

  return (
    <div
      id="profile-container"
      className="relative w-[900px] h-[500px] overflow-hidden bg-background text-foreground flex flex-col"
    >
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none render-bg-grid" />
      {/* Background glows */}
      <div className="absolute -left-16 top-12 w-[320px] h-[320px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-chart-1" />
      <div className="absolute -right-16 -bottom-8 w-[280px] h-[280px] rounded-full blur-[120px] opacity-15 pointer-events-none bg-chart-3" />

      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-5 z-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <img
          src="/assets/render/player-profile.webp"
          alt="Player Profile"
          className="h-[44px] [image-rendering:pixelated]"
        />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center px-6 pt-1 z-10">
        {/* Left: Skin render */}
        <div className="flex flex-col items-center w-[300px] shrink-0">
          <div className="relative h-[380px] flex items-end justify-center">
            {/* Glow beneath skin */}
            <div className="absolute bottom-2 w-36 h-36 rounded-full blur-[60px] opacity-40 bg-chart-1" />
            <img
              src={skinSrc}
              alt={data.username}
              className="relative h-[340px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            />
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex-1 flex flex-col gap-2.5 pl-2 pr-4">
          {/* Username + Status */}
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-wide text-foreground">
              {data.username}
            </h2>
            <div className="flex items-center gap-1.5 ml-auto">
              <div
                className={`w-2 h-2 rounded-full ${data.online ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-muted-foreground/40"}`}
              />
              <span
                className={`text-[11px] font-semibold tracking-wide uppercase ${data.online ? "text-emerald-400" : "text-muted-foreground/40"}`}
              >
                {data.online ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          {/* Balance and activity row */}
          <div className="grid grid-cols-4 gap-2">
            <StatPill label="Balance" value={formatMoney(data.cashBalance)} />
            <StatPill label="Playtime" value={data.playtime} />
            <StatPill label="Sessions" value={data.sessions.toLocaleString()} />
            <StatPill
              label="Member Since"
              value={formatDate(data.memberSince)}
            />
          </div>

          {/* Minecraft stats row */}
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

      {/* Footer */}
      <div className="pb-3.5 text-center z-10">
        <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-foreground/15">
          createrington.com
        </span>
      </div>
    </div>
  );
}
