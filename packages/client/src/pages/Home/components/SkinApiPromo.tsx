import { KNOWN_POSES } from "createrington-skin-api";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SKIN_API_DOCS_URL,
  SKIN_API_REQUEST_INVITE_URL,
} from "@/lib/external-urls";
import { cn } from "@/lib/utils";

const FIGURES = [
  {
    src: "/assets/skin-api/point-cel.webp",
    width: 224,
    height: 336,
    className: "z-10 h-28",
  },
  {
    src: "/assets/skin-api/victory-cel.webp",
    width: 288,
    height: 432,
    className: "z-20 -mx-5 h-36",
  },
  {
    src: "/assets/skin-api/cheer-cel.webp",
    width: 256,
    height: 384,
    className: "z-10 h-32",
  },
] as const;

export function SkinApiPromo() {
  return (
    <section className="@container py-10 px-5 md:px-8 bg-background">
      <div className="max-w-7xl mx-auto grid justify-items-center gap-6 text-center @xl:grid-cols-[auto_1fr] @xl:items-center @xl:justify-items-start @xl:gap-x-8 @xl:gap-y-4 @xl:text-left @5xl:grid-cols-[auto_1fr_auto] @5xl:gap-x-10">
        <div className="flex items-end justify-center @xl:row-span-2 @5xl:row-span-1">
          {FIGURES.map(({ src, width, height, className }) => (
            <img
              key={src}
              src={src}
              width={width}
              height={height}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className={cn("relative w-auto select-none", className)}
            />
          ))}
        </div>

        <div className="flex min-w-0 flex-col items-center gap-2 @xl:items-start">
          <img
            src="/assets/skin-api/skin-api-woodmark.webp"
            width={391}
            height={84}
            alt="Skin API"
            loading="lazy"
            decoding="async"
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
              href={SKIN_API_REQUEST_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get an API key
              <ArrowUpRight />
            </a>
          </Button>

          <Button variant="outline" asChild>
            <a
              href={SKIN_API_DOCS_URL}
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
