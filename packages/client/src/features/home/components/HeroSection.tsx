import { useState } from "react";
import { NavLink } from "react-router";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import { ArrowRight, Download } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useServerData } from "@/contexts/server-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { CURSEFORGE_MODPACK_URL } from "@/lib/externalUrls";
import { MAIN_SERVER_ID } from "@/lib/minecraft";
import { cn } from "@/lib/utils";
import { HERO_IMAGES } from "@/features/home/data";

export function HeroSection() {
  const { user } = useAuth();
  const { servers } = useServerData();
  const online = servers.find((s) => s.serverId === MAIN_SERVER_ID)?.online;

  const [autoplayPlugin] = useState(() =>
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  );
  const [firstHeroLoaded, setFirstHeroLoaded] = useState(false);
  const revealRemainingHeroes = () => setFirstHeroLoaded(true);

  return (
    <section className="relative w-full overflow-hidden">
      <Carousel
        opts={{ loop: true }}
        plugins={[Fade(), autoplayPlugin]}
        className="absolute inset-0 h-full"
      >
        <CarouselContent className="h-full ml-0">
          {HERO_IMAGES.map((image, index) => (
            <CarouselItem key={image} className="h-full pl-0 basis-full">
              {(index === 0 || firstHeroLoaded) && (
                <img
                  src={image}
                  alt=""
                  fetchPriority={index === 0 ? "high" : "low"}
                  decoding="async"
                  onLoad={index === 0 ? revealRemainingHeroes : undefined}
                  onError={index === 0 ? revealRemainingHeroes : undefined}
                  className="w-full h-full object-cover object-center"
                />
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="absolute top-1/3 inset-0 bg-linear-to-t from-background via-background/80 to-transparent pointer-events-none" />

      <div className="py-12 px-5 md:px-8">
        <div className="relative h-full flex flex-col max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-2 ">
            <img
              src="/assets/logo/rails-n-sails-logo.webp"
              alt="Rails 'n Sails Logo"
              className="h-16 w-auto md:h-20 lg:h-24 object-contain"
            />

            <Badge
              tone={online ? "success" : "danger"}
              className="gap-2 bg-zinc-900/70 px-2 py-2 text-lg shadow-md sm:px-4"
            >
              <span
                className={cn(
                  "size-4 rounded-full bg-current",
                  online && "animate-pulse",
                )}
              />
              <span className="hidden sm:inline">
                {online ? "Online" : "Offline"}
              </span>
            </Badge>
          </div>

          <div className="flex-1 flex items-end min-h-148">
            <div className="space-y-6 pt-12">
              <h1 className="max-w-4xl text-5xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
                Build <span className="text-primary">Big</span>. Automate{" "}
                <span className="text-primary">Everything</span>.
              </h1>

              <p className="text-lg md:text-xl lg:text-2xl text-gray-200 max-w-2xl leading-relaxed drop-shadow-md">
                Rails 'n Sails is a Create-powered server built for players who
                love clever machines, beautiful builds, and total creative
                freedom. From small farms to sprawling rail networks and
                airships, every idea has a place here.
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {!user ? (
                  <Button size="lg" className="text-lg" asChild>
                    <NavLink to="/apply-to-join">
                      Apply Now
                      <ArrowRight />
                    </NavLink>
                  </Button>
                ) : (
                  <Button size="lg" className="text-lg" asChild>
                    <a
                      href={CURSEFORGE_MODPACK_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download />
                      Download Modpack
                    </a>
                  </Button>
                )}

                <Button size="lg" variant="outline" asChild>
                  <a href="#server-features">Learn More</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
