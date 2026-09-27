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
  "Click Register in the verification channel and enter your Minecraft username.",
  "You're whitelisted automatically. Jump in and play!",
];

const WAITLIST_STEPS = [
  "Join our Discord server using the invite link.",
  "Click Join Waitlist in the verification channel.",
  "We'll ping you right there when a spot opens. Register and play!",
];

const FIGURES = [
  {
    name: "Agent772",
    src: "/assets/apply/agent772-wave.webp",
    className:
      "bottom-full left-[3%] z-0 h-40 translate-y-[38%] -rotate-3 @4xl:h-56",
  },
  {
    name: "diablothe2nd",
    src: "/assets/apply/diablothe2nd-gaze.webp",
    className:
      "bottom-full left-[24%] z-0 hidden h-36 translate-y-[52%] rotate-2 @2xl:block @4xl:h-52",
  },
  {
    name: "Saidai_V",
    src: "/assets/apply/saidai-v-ponder.webp",
    className:
      "bottom-full left-[45%] z-0 h-36 translate-y-[45%] -rotate-2 @4xl:h-52",
  },
  {
    name: "Tetsuoken",
    src: "/assets/apply/tetsuoken-cute.webp",
    className:
      "bottom-full left-[63%] z-0 hidden h-36 translate-y-[55%] rotate-3 @2xl:block @4xl:h-52",
  },
  {
    name: "saunhardy",
    src: "/assets/apply/saunhardy-relaxed.webp",
    className: "right-[2%] bottom-full z-20 h-32 translate-y-[11.5%] @4xl:h-44",
  },
  {
    name: "Cailin05",
    src: "/assets/apply/cailin05-callout.webp",
    className:
      "top-[18%] right-full z-0 hidden h-60 origin-bottom translate-x-[58%] -rotate-[16deg] @min-[77rem]:block",
  },
  {
    name: "The_BigShot",
    src: "/assets/apply/the-bigshot-point.webp",
    className:
      "bottom-0 left-full z-20 hidden h-64 -translate-x-[22%] translate-y-[6%] @min-[77rem]:block",
  },
] as const;

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
    <div className="flex flex-1 flex-col overflow-x-clip pb-20">
      <PageHeader
        title="Apply to Join"
        imageSrc="/assets/hero/space-ship-station.webp"
        description="Join our community and become a part of Createrington!"
      />

      <div className="@container px-5 pb-12 md:px-8">
        <div className="relative mx-auto mt-28 w-full max-w-5xl @4xl:mt-40">
          {FIGURES.map(({ name, src, className }) => (
            <span
              key={name}
              className={cn(
                "group pointer-events-none absolute aspect-[2/3]",
                className,
              )}
            >
              <img
                src={src}
                alt=""
                width={600}
                height={900}
                draggable={false}
                decoding="async"
                className="pointer-events-auto h-full w-auto max-w-none select-none drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out group-hover:-translate-y-[8%]"
              />
            </span>
          ))}
          <Card className="relative z-10 w-full py-3 shadow-[0_-18px_40px_-12px_rgba(0,0,0,0.7)] sm:py-6 xl:py-10">
            <CardContent className="px-3 sm:px-6 xl:px-10">
              <div className="grid gap-8 md:gap-12 lg:grid-cols-[1.1fr_1fr]">
                <div className="flex flex-col">
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

                  <div className="mt-8 lg:mt-auto lg:pt-8">
                    <Button asChild variant="discord" className="w-full">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
