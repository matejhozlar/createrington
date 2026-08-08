import { cn } from "@/lib/utils";

const HERO_IMAGE = "/assets/hero/royal-albert-hall.webp";

const GRADIENTS = {
  hub: "linear-gradient(to top, var(--background) 0%, oklch(from var(--background) l c h / 0.75) 40%, oklch(from var(--background) l c h / 0.25) 75%, transparent 100%)",
  page: "linear-gradient(to top, var(--background) 0%, oklch(from var(--background) l c h / 0.85) 45%, oklch(from var(--background) l c h / 0.4) 100%)",
};

export function WorkshopHero({
  className,
  variant = "page",
}: {
  className: string;
  variant?: "hub" | "page";
}) {
  return (
    <div className={cn("absolute inset-x-0 top-0 overflow-hidden", className)}>
      <img
        src={HERO_IMAGE}
        alt=""
        className="h-full w-full object-cover grayscale-50"
      />
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute inset-0"
        style={{ background: GRADIENTS[variant] }}
      />
    </div>
  );
}
