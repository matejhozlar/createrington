import React, { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { Download } from "lucide-react";

const features = [
  {
    icon: "/assets/features/cogwheel.webp",
    label: "Create Mod",
  },
  {
    icon: "/assets/features/player-heads.webp",
    label: "Multiplayer",
  },
  {
    icon: "/assets/features/currency.webp",
    label: "Economy",
  },
  {
    icon: "/assets/features/chipped-workbench.webp",
    label: "100+ Mods",
  },
];

export const Advertisement: React.FC = () => {
  const adRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!adRef.current) return;

    const dataUrl = await toPng(adRef.current, {
      width: 1080,
      height: 1080,
      pixelRatio: 1,
    });

    const link = document.createElement("a");
    link.download = "createrington-ad.png";
    link.href = dataUrl;
    link.click();
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-8">
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-white text-lg font-medium hover:bg-white/20 transition-colors cursor-pointer"
      >
        <Download className="size-5" />
        Download as PNG (1080x1080)
      </button>

      <div
        className="origin-top"
        style={{
          transform:
            "scale(min(calc((100vw - 64px) / 1080), calc((100vh - 140px) / 1080)))",
        }}
      >
        <div
          ref={adRef}
          className="relative overflow-hidden"
          style={{ width: 1080, height: 1080 }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('/assets/hero/gondola-station.webp')",
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/40" />

          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />

          <div className="relative h-full flex flex-col justify-between p-16">
            <div className="flex items-center gap-5">
              <img
                src="/assets/logo/cogs-and-steam-logo.webp"
                alt="Cogs and Steam"
                className="h-20 w-auto object-contain"
              />
              <div className="h-12 w-px bg-white/20" />
              <span className="text-white/60 text-xl font-medium tracking-wider uppercase">
                Create 6.0.9
              </span>
            </div>

            <div className="flex flex-col gap-6 -mt-8">
              <h1 className="text-7xl font-bold text-white leading-tight tracking-tight">
                Build Big.
                <br />
                <span style={{ color: "oklch(82.8% 0.189 84.429)" }}>
                  Automate Everything.
                </span>
              </h1>

              <p className="text-2xl text-gray-300 max-w-[680px] leading-relaxed">
                A Create-powered modded server built for players who love clever
                machines, beautiful builds, and total creative freedom.
              </p>
            </div>

            <div className="flex flex-col gap-10">
              <div className="flex gap-6">
                {features.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl px-5 py-3"
                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                  >
                    <img
                      src={feature.icon}
                      alt={feature.label}
                      className="w-10 h-10 object-contain"
                    />
                    <span className="text-white text-lg font-medium">
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-4 rounded-2xl px-8 py-4 text-2xl font-bold"
                  style={{
                    backgroundColor: "oklch(82.8% 0.189 84.429)",
                    color: "oklch(0.21 0.01 285.885)",
                  }}
                >
                  Apply Now At create-rington.com
                </div>

                <div className="flex items-center gap-3 text-white/50 text-lg">
                  <span>Minecraft 1.21.1</span>
                  <span className="text-white/20">|</span>
                  <span>NeoForge</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
