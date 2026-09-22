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
    <section className="@container py-10 px-5 md:px-8 bg-background">
      <div className="max-w-7xl mx-auto grid justify-items-center gap-6 text-center @xl:grid-cols-[auto_1fr] @xl:items-center @xl:justify-items-start @xl:gap-x-8 @xl:gap-y-4 @xl:text-left @5xl:grid-cols-[auto_1fr_auto] @5xl:gap-x-10">
        <div className="flex items-end justify-center @xl:row-span-2 @5xl:row-span-1">
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

        <div className="flex min-w-0 flex-col items-center gap-2 @xl:items-start">
          <img
            src="/assets/skin-api/skin-api-woodmark.png"
            alt="Skin API"
            className="h-6 w-auto @xl:h-7"
          />

          <h2 className="text-xl font-semibold text-foreground @xl:text-2xl">
            Any skin. Any pose.{" "}
            <span className="text-primary">One request.</span>
          </h2>

          <p className="max-w-2xl text-sm text-muted-foreground @xl:text-base">
            Our own skin renderer: any Minecraft skin as a posed PNG by UUID,
            username, URL, or upload, with {KNOWN_POSES.length} poses and SDKs
            for four languages.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 @xl:col-start-2 @xl:justify-start @5xl:col-start-3 @5xl:row-start-1">
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
