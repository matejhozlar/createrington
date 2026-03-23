import { TriangleAlert } from "lucide-react";
import React from "react";
import { PageHeader } from "../../components/page-header";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";

const rules = {
  items: [
    {
      title: "Respect All Players",
      description:
        "Treat everyone with respect. Harassment, discrimination, and offensive language are not tolerated. This includes chat, signs, builds, and any other form of communication.",
    },
    {
      title: "No Griefing or Stealing",
      description:
        "Do not destroy or alter other players' builds without permission. Respect private property and don't take items that don't belong to you, even if containers are not locked.",
    },
    {
      title: "No Cheating or Exploits",
      description:
        "Don't use any mods, hacks, or exploits that give you an unfair advantage. Allowed mods are those, which are already in the modpack, and purely cosmetic mods.",
    },
    {
      title: "Build Responsibly",
      description:
        "Keep a reasonable distance from other players' builds unless you have permission. Avoid excessive contraptions that might cause lag. Clean up floating trees and creeper holes.",
    },
    {
      title: "PvP Rules",
      description:
        "PvP is only allowed when both parties consent. No spawn killing, trapping, or luring players into PvP without their knowledge.",
    },
    {
      title: "Staff Decisions are Final",
      description:
        "Respect staff decisions. If you have a complaint, please discuss it privately with the appropriate staff member instead of causing drama in public channels.",
    },
  ],
};

export function Rules() {
  return (
    <div>
      <PageHeader
        title="Server Rules"
        description="A clear, friendly code of conduct to keep Createrington fair and welcoming for everyone."
        imageSrc="/assets/hero/high-speed-train.webp"
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl">
            <ul className="flex flex-col gap-3 md:gap-4">
              {rules.items.map((rule, index) => (
                <React.Fragment key={rule.title}>
                  {index > 0 ? <Separator className="my-2 md:my-4" /> : null}

                  <li className="flex flex-col gap-2 lg:flex-row md:gap-6">
                    <div className="lg:flex-1">
                      <div className="flex items-center gap-3">
                        <Badge className="aspect-square bg-primary/10 text-primary text-2xl">
                          {index + 1}
                        </Badge>

                        <h2 className="text-foreground text-xl md:text-2xl font-semibold">
                          {rule.title}
                        </h2>
                      </div>
                    </div>

                    <p className="text-muted-foreground text-base/7 lg:flex-1">
                      {rule.description}
                    </p>
                  </li>
                </React.Fragment>
              ))}
            </ul>

            <Alert className="mt-8 md:mt-12 border-amber-900 bg-amber-950 text-amber-50">
              <TriangleAlert />

              <AlertTitle>Enforcement Notice</AlertTitle>

              <AlertDescription>
                Failure to follow these rules may result in warnings, temporary
                bans, or permanent removal from the server depending on the
                severity and frequency of violations. If you witness rule
                violations, please report them to staff rather than taking
                matters into your own hands.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </section>
    </div>
  );
}
