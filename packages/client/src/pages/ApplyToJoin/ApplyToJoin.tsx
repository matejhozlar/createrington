import { ExternalLink } from "lucide-react";
import { DISCORD_INVITE_URL } from "@/lib/external-urls";
import { NavLink } from "react-router";
import { Loading } from "@/components/loading-spinner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const OPEN_STEPS = [
  "Join our Discord server using the invite link.",
  "Click Register in your private verification channel and enter your Minecraft username.",
  "You're whitelisted automatically. Jump in and play!",
];

const WAITLIST_STEPS = [
  "Join our Discord server using the invite link.",
  "Click Join Waitlist in your private verification channel.",
  "We'll ping you right there when a spot opens. Register and play!",
];

const POLICY_LINKS = [
  { label: "Rules", to: "/rules" },
  { label: "Terms of Service", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
];

export function ApplyToJoin() {
  const statusQuery = trpc.public.waitlists.status.useQuery();

  const mode = statusQuery.data?.mode;
  const isWaitlistMode = mode === "waitlist";

  if (statusQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loading size="medium" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-20">
      <PageHeader
        title="Apply to Join"
        imageSrc="/assets/hero/space-ship-station.webp"
        description="Join our community and become a part of Createrington!"
      />

      <div className="pb-12 lg:py-16 px-5 md:px-8">
        <Card className="mx-auto w-full max-w-7xl py-3 sm:py-6 xl:py-10">
          <CardContent className="px-3 sm:px-6 xl:px-10">
            <div className="grid gap-8 md:gap-16 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-xl h-fit border border-border/60 bg-background p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold">
                    {isWaitlistMode ? "Join the Waitlist" : "Join the Server"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isWaitlistMode
                      ? "We're at capacity right now. Hop into our Discord and join the waitlist from your private verification channel; we'll ping you there the moment a spot opens up."
                      : "No application needed right now. Hop into our Discord and register with your Minecraft username to get whitelisted."}
                  </p>
                </div>

                <Button asChild className="w-full">
                  <a
                    href={DISCORD_INVITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 size-4" />
                    Join Our Discord
                  </a>
                </Button>

                <p className="mt-4 text-xs text-muted-foreground">
                  By registering you agree to our{" "}
                  {POLICY_LINKS.map((link, index) => (
                    <span key={link.to}>
                      <NavLink
                        to={link.to}
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        {link.label}
                      </NavLink>
                      {index < POLICY_LINKS.length - 2
                        ? ", "
                        : index === POLICY_LINKS.length - 2
                          ? " and "
                          : "."}
                    </span>
                  ))}
                </p>
              </div>

              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-3xl md:text-4xl font-semibold text-foreground">
                    Current Status
                  </h2>

                  <div className="mt-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-8 py-2 text-xl rounded-md uppercase font-bold",
                        isWaitlistMode
                          ? "bg-amber-500 text-background"
                          : "bg-success text-background",
                      )}
                    >
                      {isWaitlistMode ? "Waitlist" : "Open Enrollment"}
                    </Badge>
                  </div>

                  <p className="mt-4 text-base md:text-lg text-muted-foreground">
                    {isWaitlistMode
                      ? "Thank you for showing interest in our server! We're currently at our capacity, but you can join the waitlist through our Discord to reserve a spot."
                      : "Thank you for showing interest in our server! We have open spots available. Join the Discord to get started."}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    What happens next
                  </h3>
                  <ol className="mt-4 space-y-3 text-sm md:text-base text-muted-foreground">
                    {(isWaitlistMode ? WAITLIST_STEPS : OPEN_STEPS).map(
                      (step, index) => (
                        <li key={step} className="flex gap-3">
                          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold text-foreground">
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ),
                    )}
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
