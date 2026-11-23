import { ECONOMY_FEATURES } from "@/features/home/data";
import { SectionHeading } from "./SectionHeading";

export function EconomySection() {
  return (
    <section className="py-16 px-5 md:px-8 bg-zinc-950">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 flex flex-col gap-8">
            <SectionHeading
              title="A Revolutionary Economy System"
              subtitle="Earn, spend, and manage your wealth with our custom-built economy plugin"
              subtitleClassName="max-w-none"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              {ECONOMY_FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex flex-col gap-5">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="text-primary size-5" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="text-foreground font-semibold">{title}</h3>

                    <p className="text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full flex-1">
            <div className="relative w-full aspect-square">
              <img
                src="/assets/features/gondola-station-atms.webp"
                alt="Economy system featuring ATMs and banking"
                className="rounded-xl object-cover w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
