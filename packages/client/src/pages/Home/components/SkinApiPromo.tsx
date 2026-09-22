import { KNOWN_POSES } from "createrington-skin-api";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SKIN_API_URL } from "@/lib/external-urls";

const FIGURES = [
  { src: "/assets/skin-api/point-cel.png", className: "z-10 h-28" },
  { src: "/assets/skin-api/victory-cel.png", className: "z-20 -mx-5 h-36" },
  { src: "/assets/skin-api/cheer-cel.png", className: "z-10 h-32" },
] as const;

export function SkinApiPromo() {
  return (
    <section className="py-10 px-5 md:px-8 bg-background">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-6 text-center md:flex-row md:gap-8 md:text-left lg:gap-10">
        <div className="flex shrink-0 items-end justify-center">
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

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:items-start">
          <img
            src="/assets/skin-api/skin-api-woodmark.png"
            alt="Skin API"
            className="h-6 w-auto md:h-7"
          />

          <h2 className="text-xl font-semibold text-foreground md:text-2xl">
            Any skin. Any pose.{" "}
            <span className="text-primary">One request.</span>
          </h2>

          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Our own skin renderer: any Minecraft skin as a posed PNG by UUID,
            username, URL, or upload, with {KNOWN_POSES.length} poses and SDKs
            for four languages.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap justify-center gap-3">
          <Button asChild>
            <a
              href={`${SKIN_API_URL}/request-invite`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get an API key
              <ArrowUpRight />
            </a>
          </Button>

          <Button variant="outline" asChild>
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
    </section>
  );
}
