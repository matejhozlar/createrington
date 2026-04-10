import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SkinViewer as SkinViewerLib } from "skinview3d";

interface ProfileData {
  username: string;
  uuid: string;
  online: boolean;
  networth: string;
  cashBalance: string;
  cryptoValue: string;
  playtime: string;
  playtimeSeconds: number;
  sessions: number;
  memberSince: string;
}

function formatNumber(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const [params] = useSearchParams();
  const [data, setData] = useState<ProfileData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [skinReady, setSkinReady] = useState(false);
  const skinContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SkinViewerLib | null>(null);

  const secret = params.get("secret");
  const player = params.get("player");
  const hasMissingParams = !secret || !player;

  // Fetch profile data
  useEffect(() => {
    if (hasMissingParams) return;

    const url = new URL("/api/render/profile", window.location.origin);
    url.searchParams.set("secret", secret);
    url.searchParams.set("player", player);

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<ProfileData>;
      })
      .then(setData)
      .catch(() => setFetchError("Failed to load profile data"));
  }, [hasMissingParams, secret, player]);

  // Initialize skinview3d once data arrives
  useEffect(() => {
    if (!data || !skinContainerRef.current) return;

    const viewer = new SkinViewerLib({
      width: 280,
      height: 380,
      enableControls: false,
      fov: 50,
      zoom: 0.85,
    });

    viewer.autoRotate = false;
    viewer.animation = null;

    // 3/4 view — rotate entire model so camera sees it from an angle
    viewer.playerObject.rotation.y = 0.4;

    viewer
      .loadSkin(`/api/skin/${data.uuid}`)
      .then(() => {
        // Head turned slightly back toward viewer
        viewer.playerObject.skin.head.rotation.y = -0.2;

        setSkinReady(true);
      })
      .catch(() => {
        // Still show the card even if skin fails
        setSkinReady(true);
      });

    skinContainerRef.current.appendChild(viewer.canvas);
    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [data]);

  const error = hasMissingParams ? "Missing parameters" : fetchError;

  if (error) {
    return (
      <div className="w-[900px] h-[500px] bg-background flex items-center justify-center">
        <span className="text-base tracking-wide text-destructive">
          {error}
        </span>
      </div>
    );
  }

  if (!data || !skinReady) {
    return (
      <div className="w-[900px] h-[500px] bg-background flex items-center justify-center">
        <div ref={skinContainerRef} className="hidden" />
        <span className="text-base tracking-wide text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div
      id="profile-container"
      className="relative w-[900px] h-[500px] overflow-hidden bg-background text-foreground flex flex-col"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Background glows */}
      <div className="absolute -left-16 top-12 w-[320px] h-[320px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-chart-1" />
      <div className="absolute -right-16 -bottom-8 w-[280px] h-[280px] rounded-full blur-[120px] opacity-15 pointer-events-none bg-chart-3" />

      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-5 z-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <h1 className="text-[12px] font-semibold tracking-[0.35em] uppercase text-muted-foreground/40">
          Player Profile
        </h1>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center px-6 pt-1 z-10">
        {/* Left: 3D skin */}
        <div className="flex flex-col items-center w-[300px] shrink-0">
          <div className="relative h-[380px] flex items-end justify-center">
            {/* Glow beneath skin */}
            <div className="absolute bottom-2 w-36 h-36 rounded-full blur-[60px] opacity-40 bg-chart-1" />
            <div
              ref={skinContainerRef}
              className="relative drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            />
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex-1 flex flex-col gap-4 pl-2 pr-4">
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

          {/* Finance row */}
          <div className="grid grid-cols-3 gap-2.5">
            <StatPill
              label="Networth"
              value={`$${formatNumber(data.networth)}`}
            />
            <StatPill
              label="Cash"
              value={`$${formatNumber(data.cashBalance)}`}
            />
            <StatPill
              label="Crypto"
              value={`$${formatNumber(data.cryptoValue)}`}
            />
          </div>

          {/* Activity row */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatPill label="Playtime" value={data.playtime} />
            <StatPill label="Sessions" value={data.sessions.toLocaleString()} />
          </div>

          {/* Member since */}
          <StatPill label="Member Since" value={formatDate(data.memberSince)} />
        </div>
      </div>

      {/* Footer */}
      <div className="pb-3.5 text-center z-10">
        <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-foreground/15">
          create-rington.com
        </span>
      </div>
    </div>
  );
}
