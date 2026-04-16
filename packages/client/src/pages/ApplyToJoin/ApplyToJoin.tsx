import { CheckCircle, Clock, ExternalLink } from "lucide-react";
import { DISCORD_INVITE_URL } from "@/lib/external-urls";
import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loading } from "@/components/loading-spinner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

interface FormValues {
  discordName: string;
  email: string;
  referralSource: string;
  referralOther: string;
  agreedToTerms: boolean;
}

/**
 * Waitlist vs open-enrollment changes which fields are required, so the
 * schema is rebuilt whenever mode changes. Running this once at load is fine
 * — status mode is fetched once and stable for the life of the form.
 */
function buildSchema(isWaitlistMode: boolean) {
  return z
    .object({
      discordName: z.string(),
      email: z.string(),
      referralSource: z.string(),
      referralOther: z.string(),
      agreedToTerms: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (!values.agreedToTerms) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "You must agree to the Privacy Policy and Terms of Service",
          path: ["agreedToTerms"],
        });
      }

      if (isWaitlistMode) {
        if (!values.email.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Email is required",
            path: ["email"],
          });
        } else if (!z.string().email().safeParse(values.email).success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a valid email address",
            path: ["email"],
          });
        }

        if (!values.discordName.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Discord username is required",
            path: ["discordName"],
          });
        }
      }
    });
}

export function ApplyToJoin() {
  const statusQuery = trpc.public.waitlists.status.useQuery();
  const createMutation = trpc.public.waitlists.create.useMutation();

  const mode = statusQuery.data?.mode;
  const isWaitlistMode = mode === "waitlist";

  const schema = useMemo(() => buildSchema(isWaitlistMode), [isWaitlistMode]);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      discordName: "",
      email: "",
      referralSource: "",
      referralOther: "",
      agreedToTerms: false,
    },
  });

  const referralSource = useWatch({ control, name: "referralSource" });

  const result = createMutation.data;
  const isAutoAccepted = result?.status === "auto_accepted";

  const onSubmit = handleSubmit(async (values) => {
    const metadata: Record<string, string> = {};
    if (values.referralSource) {
      metadata.referralSource =
        values.referralSource === "Other"
          ? values.referralOther.trim() || "Other"
          : values.referralSource;
    }

    try {
      await createMutation.mutateAsync({
        discordName: values.discordName.trim() || undefined,
        email: values.email.trim() || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
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

  // Success state
  if (result) {
    if (isAutoAccepted && "inviteUrl" in result) {
      return (
        <div className="flex flex-1 items-center justify-center px-4 py-20">
          <div className="w-full max-w-md rounded-lg border border-success bg-success/5 p-8 text-center">
            <CheckCircle className="mx-auto mb-4 size-12 text-success" />
            <h2 className="mb-2 text-2xl font-semibold">You're In!</h2>
            <p className="mb-6 text-muted-foreground">
              You've been automatically accepted. Click the button below to join
              our Discord using your personal invite, then run{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                /register &lt;your_mc_name&gt;
              </code>{" "}
              to get whitelisted.
            </p>

            <Button asChild className="w-full">
              <a
                href={result.inviteUrl}
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

    // Pending state
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-md rounded-lg border border-sidebar-primary bg-sidebar-primary/5 p-8 text-center">
          <Clock className="mx-auto mb-4 size-12 text-sidebar-primary" />
          <h2 className="mb-2 text-2xl font-semibold">
            You're on the Waitlist!
          </h2>
          <p className="mb-6 text-muted-foreground">
            Thanks for applying! We'll email you when a spot opens up. In the
            meantime, feel free to join our Discord community.
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

  // Form state
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
                    {isWaitlistMode
                      ? "Waitlist Application"
                      : "Server Application"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isWaitlistMode
                      ? "Share your details and we'll reach out when a spot opens."
                      : "Accept the terms to get your Discord invite."}
                  </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4" noValidate>
                  {isWaitlistMode && (
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
                  )}

                  {isWaitlistMode && (
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
                  )}

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

                  <div className="flex items-start gap-2">
                    <Controller
                      control={control}
                      name="agreedToTerms"
                      render={({ field }) => (
                        <Checkbox
                          id="agree-terms"
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                          className="mt-0.5 cursor-pointer"
                        />
                      )}
                    />
                    <label
                      htmlFor="agree-terms"
                      className="text-sm text-muted-foreground cursor-pointer select-none"
                    >
                      I agree to the{" "}
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
                    </label>
                  </div>

                  {(errors.agreedToTerms || errors.root) && (
                    <FieldError>
                      {errors.agreedToTerms?.message ?? errors.root?.message}
                    </FieldError>
                  )}

                  <Button
                    type="submit"
                    className="w-full cursor-pointer"
                    disabled={isSubmitting || createMutation.isPending}
                  >
                    {isSubmitting || createMutation.isPending
                      ? "Submitting..."
                      : isWaitlistMode
                        ? "Join Waitlist"
                        : "Apply Now"}
                  </Button>
                </form>
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
                      ? "Thank you for showing interest in our server! We're currently at our capacity, but you can join the waitlist to reserve a spot."
                      : "Thank you for showing interest in our server! We have open spots available. Apply now to get started."}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    What happens next
                  </h3>
                  <ol className="mt-4 space-y-3 text-sm md:text-base text-muted-foreground">
                    <li className="flex gap-3">
                      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold text-foreground">
                        1
                      </span>
                      {isWaitlistMode
                        ? "Submit your application with your email and Discord username."
                        : "Accept the terms and submit your application."}
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold text-foreground">
                        2
                      </span>
                      {isWaitlistMode
                        ? "We'll review and email you a personal Discord invite when a spot opens."
                        : "You'll get a personal Discord invite on the next screen."}
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold text-foreground">
                        3
                      </span>
                      Join the Discord and start building with the community.
                    </li>
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
