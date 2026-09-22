import { KNOWN_POSES } from "createrington-skin-api";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SKIN_API_URL } from "@/lib/external-urls";

const FIGURES = [
  {
    src: "/assets/skin-api/point-cel-outline.png",
    className: "z-10 h-36 lg:h-48",
  },
  {
    src: "/assets/skin-api/victory-cel-outline.png",
    className: "z-20 -mx-5 h-44 lg:-mx-6 lg:h-60",
  },
  {
    src: "/assets/skin-api/cheer-cel-outline.png",
    className: "z-10 h-40 lg:h-52",
  },
] as const;

const PROOF_POINTS = [
  `${KNOWN_POSES.length} poses`,
  "4 SDKs",
  "Cached in milliseconds",
] as const;

export function SkinApiPromo() {
  return (
    <section className="py-16 px-5 md:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-xl border border-border bg-linear-to-b from-zinc-900 to-zinc-950">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,185,0,0.18),transparent_60%)] lg:bg-[radial-gradient(circle_at_84%_78%,rgba(255,185,0,0.18),transparent_42%)]" />

          <div className="relative grid gap-10 px-6 pt-6 sm:px-8 sm:pt-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:px-10 lg:pt-10">
            <div className="flex flex-col gap-5 pb-6 sm:pb-8 lg:pb-10">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <img
                  src="/assets/logo/logo.png"
                  alt=""
                  className="size-5 object-contain"
                />
                Also from Createrington
              </div>

              <img
                src="/assets/skin-api/skin-api-woodmark.png"
                alt="Skin API"
                className="h-9 w-auto self-start sm:h-11"
              />

              <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
                Any skin. Any pose.{" "}
                <span className="text-primary">One request.</span>
              </h2>

              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                Turn any Minecraft skin into a posed, framed PNG by UUID,
                username, URL, or upload. It is the renderer behind our Discord
                cards, and it is open to other projects.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 items-center rounded-md border border-primary/35 bg-primary/10 px-2.5 font-mono text-xs text-foreground">
                  <span className="font-bold text-primary">GET</span>
                  &nbsp;/v1/render
                </span>

                {PROOF_POINTS.map((point) => (
                  <span
                    key={point}
                    className="inline-flex h-7 items-center rounded-md border border-border bg-muted/40 px-2.5 text-xs text-muted-foreground"
                  >
                    {point}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                <Button size="lg" asChild>
                  <a
                    href={`${SKIN_API_URL}/request-invite`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get an API key
                    <ArrowUpRight />
                  </a>
                </Button>

                <Button size="lg" variant="outline" asChild>
                  <a
                    href={`${SKIN_API_URL}/docs`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <BookOpen />
                    Read the docs
                  </a>
                </Button>
              </div>
            </div>

            <div className="relative flex items-end justify-center self-end lg:pr-4">
              <div className="pointer-events-none absolute bottom-0 left-1/2 h-6 w-3/4 -translate-x-1/2 rounded-[100%] bg-primary/30 blur-xl" />

              {FIGURES.map(({ src, className }) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  draggable={false}
                  className={`relative w-auto select-none ${className}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
