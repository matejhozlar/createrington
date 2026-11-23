import type { ReactNode } from "react";
import { DISCORD_COLORS } from "./colors";

export function DiscordMessageFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ backgroundColor: DISCORD_COLORS.background }}
      className="rounded-lg p-4 font-sans text-sm wrap-anywhere"
    >
      <div className="flex items-start gap-3">
        <img
          src="/assets/logo/logo.png"
          alt="Createrington"
          className="size-10 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="font-medium text-white">Createrington</span>
            <span
              className="rounded px-1 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: DISCORD_COLORS.blurple }}
            >
              APP
            </span>
            <span className="text-xs" style={{ color: DISCORD_COLORS.muted }}>
              Today at{" "}
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
