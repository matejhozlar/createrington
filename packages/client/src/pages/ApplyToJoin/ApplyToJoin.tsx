import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Clock, Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const REFERRAL_OPTIONS = [
  "Discord",
  "Reddit",
  "YouTube",
  "Friend",
  "CurseForge",
  "Other",
] as const;

export function ApplyToJoin() {
  const statusQuery = trpc.waitlists.status.useQuery();
  const createMutation = trpc.waitlists.create.useMutation();

  const [discordName, setDiscordName] = useState("");
  const [email, setEmail] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [referralOther, setReferralOther] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mode = statusQuery.data?.mode;
  const isWaitlistMode = mode === "waitlist";

  const result = createMutation.data;
  const isAutoAccepted = result?.status === "auto_accepted";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!discordName.trim()) {
      setFormError("Discord username is required");
      return;
    }

    const metadata: Record<string, string> = {};
    if (referralSource) {
      metadata.referralSource =
        referralSource === "Other" ? referralOther || "Other" : referralSource;
    }

    try {
      await createMutation.mutateAsync({
        discordName: discordName.trim(),
        email: email.trim() || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setFormError(message);
    }
  };

  const handleCopyToken = async () => {
    if (!result || !("token" in result) || !result.token) return;
    try {
      await navigator.clipboard.writeText(result.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  };

  if (statusQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loading size="medium" text="Loading..." />
      </div>
    );
  }

  // Success state
  if (result) {
    if (isAutoAccepted && "token" in result) {
      return (
        <div className="flex flex-1 items-center justify-center px-4 py-20">
          <div className="w-full max-w-md rounded-lg border border-success bg-success/5 p-8 text-center">
            <CheckCircle className="mx-auto mb-4 size-12 text-success" />
            <h2 className="mb-2 text-2xl font-semibold">You're In!</h2>
            <p className="mb-6 text-muted-foreground">
              You've been automatically accepted. Use the token below to
              complete your registration.
            </p>

            <div className="mb-6 rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Your Access Token
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-muted px-3 py-2 text-sm">
                  {result.token}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 cursor-pointer"
                  onClick={handleCopyToken}
                >
                  <Copy className="mr-1 size-3.5" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <Button asChild className="w-full cursor-pointer">
              <a
                href="https://discord.gg/createrington"
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

          <Button asChild variant="outline" className="w-full cursor-pointer">
            <a
              href="https://discord.gg/createrington"
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
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold">Apply to Join</h1>
          <p className="text-muted-foreground">
            {isWaitlistMode
              ? "We're currently at capacity. Join the waitlist and we'll reach out when a spot opens."
              : "We have open spots available! Fill out the form below to get started."}
          </p>
          <Badge
            variant="outline"
            className={
              isWaitlistMode
                ? "mt-3 border-amber-500 bg-amber-500/10 text-amber-500"
                : "mt-3 border-success bg-success/10 text-success"
            }
          >
            {isWaitlistMode ? "Waitlist Mode" : "Open Enrollment"}
          </Badge>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-border bg-card p-6"
        >
          <Field>
            <FieldLabel htmlFor="discord-name">Discord Username</FieldLabel>
            <Input
              id="discord-name"
              type="text"
              placeholder="e.g. username"
              value={discordName}
              onChange={(e) => setDiscordName(e.target.value)}
              required
            />
          </Field>

          {isWaitlistMode && (
            <Field>
              <FieldLabel htmlFor="email">Email Address</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="referral">
              How did you find us?{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </FieldLabel>
            <Select value={referralSource} onValueChange={setReferralSource}>
              <SelectTrigger id="referral" className="cursor-pointer">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent position="popper">
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
          </Field>

          {referralSource === "Other" && (
            <Field>
              <FieldLabel htmlFor="referral-other">Please specify</FieldLabel>
              <Input
                id="referral-other"
                type="text"
                placeholder="Where did you hear about us?"
                value={referralOther}
                onChange={(e) => setReferralOther(e.target.value)}
              />
            </Field>
          )}

          {formError && <FieldError>{formError}</FieldError>}

          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? "Submitting..."
              : isWaitlistMode
                ? "Join Waitlist"
                : "Apply Now"}
          </Button>
        </form>
      </div>
    </div>
  );
}
