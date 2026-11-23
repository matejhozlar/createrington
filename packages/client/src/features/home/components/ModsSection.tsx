import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CURSEFORGE_MODPACK_URL } from "@/lib/externalUrls";
import { MOD_CATEGORIES } from "@/features/home/data";
import { SectionHeading } from "./SectionHeading";

export function ModsSection() {
  return (
    <section className="py-16 px-5 md:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <SectionHeading
            title="The Ultimate Create Experience"
            subtitle="Just a few of the curated selection of mods that power our server."
          />

          <Button size="lg" variant="secondary" asChild className="shrink-0">
            <a
              href={`${CURSEFORGE_MODPACK_URL}/relations/dependencies`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Full Modlist
              <ExternalLink className="ml-2" />
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {MOD_CATEGORIES.map(({ title, icon: Icon, mods }) => (
            <div key={title} className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="size-5 text-primary" />
                </div>

                <h3 className="text-xl font-semibold text-foreground">
                  {title}
                </h3>
              </div>

              <div className="flex flex-col gap-3">
                {mods.map((mod) => (
                  <a
                    key={mod.url}
                    href={mod.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-1 rounded-lg p-3 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-1">
                      <p className="font-medium text-foreground">{mod.name}</p>

                      <ExternalLink className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {mod.description}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
