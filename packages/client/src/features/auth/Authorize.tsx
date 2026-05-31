import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/auth/";
import { api } from "@/services/api/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/loading-spinner";
import { toast } from "sonner";
import { ShieldCheck, User, Hash, BadgeCheck } from "lucide-react";

interface ConsentResponse {
  success: boolean;
  data: {
    appName: string;
    appOrigin: string;
    scopes: string[];
  };
}

const SCOPE_LABELS: Record<string, { icon: typeof User; label: string }> = {
  minecraftUsername: { icon: User, label: "Minecraft username" },
  playerId: { icon: Hash, label: "Player ID" },
  isMember: { icon: BadgeCheck, label: "Membership status" },
};

interface AuthorizeResponse {
  success: boolean;
  data: { redirectUrl: string };
}

export function Authorize() {
  const [params] = useSearchParams();
  const state = params.get("state") ?? "";
  const { user, loading, login } = useAuth();

  const [consent, setConsent] = useState<ConsentResponse["data"] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);

  // Logged-out users go through the normal Createrington login and return
  // here (the state query is preserved across the round trip), then see
  // consent. Skip the round-trip when there's no state: the request is already
  // invalid, so logging in would only land them on the error card.
  useEffect(() => {
    if (!loading && !user && state) login();
  }, [loading, user, login, state]);

  useEffect(() => {
    if (loading || !user || !state) return;

    let cancelled = false;
    api
      .get<ConsentResponse>("api/auth/sso/consent", { state })
      .then((res) => {
        if (cancelled) return;
        setConsent(res.data);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user, state]);

  const submit = useCallback(
    async (action: "approve" | "deny") => {
      setSubmitting(action);
      try {
        const res = await api.post<AuthorizeResponse>(
          "api/auth/sso/authorize",
          {
            state,
            action,
          },
        );
        window.location.href = res.data.redirectUrl;
      } catch {
        setSubmitting(null);
        toast.error("Something went wrong. Please try again.");
      }
    },
    [state],
  );

  // A missing state param is an invalid request; surface the error card
  // immediately rather than spinning on auth or a fetch that never runs.
  const showError = !state || status === "error";

  if (!showError && (loading || !user || status === "loading")) {
    return <Loading mode="fullscreen" size="large" text="Loading..." />;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background select-none">
      <Card className="w-full max-w-md border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <CardHeader className="items-center space-y-3 text-center">
          <img
            src="/assets/logo/logo.png"
            alt="Createrington"
            className="size-14 object-contain"
          />
          {showError ? (
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Authorization request expired
              </h1>
              <p className="text-sm text-muted-foreground">
                This request is no longer valid. Return to the app and try
                again.
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Authorize access
              </h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {consent?.appName}
                </span>{" "}
                wants to access your Createrington account.
              </p>
              {consent?.appOrigin && (
                <p className="mt-1 text-xs text-muted-foreground/80">
                  {consent.appOrigin}
                </p>
              )}
            </div>
          )}
        </CardHeader>

        {status === "ready" && consent && (
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                This will share
              </div>
              <ul className="space-y-3 text-sm">
                {consent.scopes
                  .filter((scope) => scope in SCOPE_LABELS)
                  .map((scope) => (
                    <ShareRow
                      key={scope}
                      icon={SCOPE_LABELS[scope].icon}
                      label={SCOPE_LABELS[scope].label}
                    />
                  ))}
              </ul>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              By authorizing, you agree this app may use the data above per our{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" className="text-primary hover:underline">
                Terms of Service
              </a>
              .
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => submit("deny")}
                disabled={submitting !== null}
              >
                Deny
              </Button>
              <Button
                onClick={() => submit("approve")}
                disabled={submitting !== null}
              >
                Authorize
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ShareRow({ icon: Icon, label }: { icon: typeof User; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-foreground">{label}</span>
    </li>
  );
}

export default Authorize;
