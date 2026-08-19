import { Clock, ExternalLink } from "lucide-react";
import { DISCORD_INVITE_URL } from "@/lib/external-urls";
import { NavLink } from "react-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { waitlistFormSchema } from "@createrington/shared/api";
import { Loading } from "@/components/loading-spinner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const REFERRAL_OPTIONS = [
  "Discord",
  "Reddit",
  "YouTube",
  "Friend",
  "CurseForge",
  "Other",
] as const;

const OPEN_STEPS = [
  "Join our Discord server using the invite link.",
  "Click Register in your private verification channel and enter your Minecraft username.",
  "You're whitelisted automatically. Jump in and play!",
];

const WAITLIST_STEPS = [
  "Submit your application with your email and Discord username.",
  "We'll review and email you a personal Discord invite when a spot opens.",
  "Join the Discord and start building with the community.",
];

interface FormValues {
  discordName: string;
  email: string;
  referralSource: string;
  referralOther: string;
}

export function ApplyToJoin() {
  const statusQuery = trpc.public.waitlists.status.useQuery();
  const createMutation = trpc.public.waitlists.create.useMutation();

  const mode = statusQuery.data?.mode;
  const isWaitlistMode = mode === "waitlist";

  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(waitlistFormSchema),
    defaultValues: {
      discordName: "",
      email: "",
      referralSource: "",
      referralOther: "",
    },
  });

  const referralSource = useWatch({ control, name: "referralSource" });

  const result = createMutation.data;

  const onSubmit = handleSubmit(async (values) => {
    // Drop any stale server error from a previous failed submit so the
    // user sees only the outcome of this attempt.
    clearErrors("root");
    const metadata: Record<string, string> = {};
    if (values.referralSource) {
      metadata.referralSource =
        values.referralSource === "Other"
          ? values.referralOther.trim() || "Other"
          : values.referralSource;
    }

    try {
      await createMutation.mutateAsync({
        discordName: values.discordName.trim(),
        email: values.email.trim(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      // Surfaced at the bottom of the form under the submit button, matching
      // the previous `formError` placement.
      setError("root", { message });
    }
  });

  if (statusQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loading size="medium" text="Loading..." />
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-md rounded-lg border border-sidebar-primary bg-sidebar-primary/5 p-8 text-center">
          <Clock className="mx-auto mb-4 size-12 text-sidebar-primary" />
          <h2 className="mb-2 text-2xl font-semibold">
            You're on the Waitlist!
          </h2>
          <p className="mb-6 text-muted-foreground">
            {result.message} In the meantime, feel free to join our Discord
            community.
          </p>

          <Button asChild variant="outline" className="w-full">
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 size-4" />
              Join Our Discord
            </a>
          </Button>
        </div>
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
              {isWaitlistMode ? (
                <div className="rounded-xl h-fit border border-border/60 bg-background p-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold">
                      Waitlist Application
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Share your details and we'll reach out when a spot opens.
                    </p>
                  </div>

                  <form onSubmit={onSubmit} className="space-y-4" noValidate>
                    <Field data-invalid={!!errors.email}>
                      <FieldLabel htmlFor="email">Email Address</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        aria-invalid={!!errors.email}
                        {...register("email")}
                      />
                      <FieldError>{errors.email?.message}</FieldError>
                    </Field>

                    <Field data-invalid={!!errors.discordName}>
                      <FieldLabel htmlFor="discord-name">
                        Discord Username
                      </FieldLabel>
                      <Input
                        id="discord-name"
                        type="text"
                        placeholder="e.g. username"
                        aria-invalid={!!errors.discordName}
                        {...register("discordName")}
                      />
                      <FieldError>{errors.discordName?.message}</FieldError>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="referral">
                        How did you find us?{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </FieldLabel>
                      <Controller
                        control={control}
                        name="referralSource"
                        render={({ field }) => (
                          <Select
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger id="referral">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {REFERRAL_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option}
                                  value={option}
                                  className="cursor-pointer"
                                >
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>

                    {referralSource === "Other" && (
                      <Field>
                        <FieldLabel htmlFor="referral-other">
                          Please specify
                        </FieldLabel>
                        <Input
                          id="referral-other"
                          type="text"
                          placeholder="Where did you hear about us?"
                          {...register("referralOther")}
                        />
                      </Field>
                    )}

                    <p className="text-xs text-muted-foreground">
                      By applying you agree to the{" "}
                      <NavLink
                        to="/privacy"
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        Privacy Policy
                      </NavLink>{" "}
                      and{" "}
                      <NavLink
                        to="/terms"
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        Terms of Service
                      </NavLink>
                      .
                    </p>

                    <Button
                      type="submit"
                      className="w-full cursor-pointer"
                      loading={isSubmitting}
                    >
                      Join Waitlist
                    </Button>

                    {errors.root && (
                      <FieldError>{errors.root.message}</FieldError>
                    )}
                  </form>
                </div>
              ) : (
                <div className="rounded-xl h-fit border border-border/60 bg-background p-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold">Join the Server</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      No application needed right now. Hop into our Discord and
                      register with your Minecraft username to get whitelisted.
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
                    <NavLink
                      to="/rules"
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      Rules
                    </NavLink>
                    ,{" "}
                    <NavLink
                      to="/terms"
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      Terms of Service
                    </NavLink>{" "}
                    and{" "}
                    <NavLink
                      to="/privacy"
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      Privacy Policy
                    </NavLink>
                    .
                  </p>
                </div>
              )}

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
                      ? "Thank you for showing interest in our server! We're currently at our capacity, but you can join the waitlist to reserve a spot."
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
