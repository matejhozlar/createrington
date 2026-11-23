import { cn } from "@/lib/utils";

const GLOW_CLASS = "pointer-events-none absolute rounded-full blur-[120px]";
const RULE_CLASS =
  "h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent";

export function RenderWordmark() {
  return (
    <span className="text-[11px] font-semibold tracking-[0.3em] text-foreground/15 uppercase">
      createrington.com
    </span>
  );
}

export function RenderFrame({
  id,
  banner,
  glows,
  footer,
  children,
}: {
  id: string;
  banner: { src: string; alt: string };
  glows: string[];
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="relative flex h-[500px] w-[900px] flex-col overflow-hidden bg-background text-foreground"
    >
      <div className="render-bg-grid pointer-events-none absolute inset-0" />
      {glows.map((glow) => (
        <div key={glow} className={cn(GLOW_CLASS, glow)} />
      ))}

      <div className="z-10 flex items-center gap-4 px-8 pt-5">
        <div className={RULE_CLASS} />
        <img
          src={banner.src}
          alt={banner.alt}
          className="h-[44px] [image-rendering:pixelated]"
        />
        <div className={RULE_CLASS} />
      </div>

      {children}

      {footer ?? (
        <div className="z-10 pb-3.5 text-center">
          <RenderWordmark />
        </div>
      )}
    </div>
  );
}
