import { useState } from "react";
import { Heart, Repeat, Zap, Star } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

// =============================================================================
// Static data
// =============================================================================

const DONATION_TIERS = [
  {
    amountCents: 500,
    label: "€5",
    description: "Buy me a coffee",
    icon: Zap,
    popular: false,
  },
  {
    amountCents: 1000,
    label: "€10",
    description: "Support the server",
    icon: Heart,
    popular: false,
  },
  {
    amountCents: 2000,
    label: "€20",
    description: "Keep the lights on",
    icon: Star,
    popular: true,
  },
  {
    amountCents: 5000,
    label: "€50",
    description: "Champion supporter",
    icon: Star,
    popular: false,
  },
] as const;

const PERKS = [
  "Supporter role on Discord",
  "Our eternal gratitude",
  "Keep Createrington alive and running",
];

// =============================================================================
// Component
// =============================================================================

export function Donate() {
  const toast = useToastActions();

  const [type, setType] = useState<"one_time" | "monthly">("one_time");
  const [selectedCents, setSelectedCents] = useState<number>(2000);

  const createCheckout = trpc.user.donations.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => {
      toast.error("Failed to start checkout", err.message);
    },
  });

  function handleDonate() {
    createCheckout.mutate({ type, amountCents: selectedCents });
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Support Createrington"
        description="Help keep the server running and make it even better for everyone."
      />

      <div className="max-w-2xl mx-auto px-5 pb-16 space-y-10">
        {/* Donation type toggle */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setType("one_time")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              type === "one_time"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Zap className="size-4" />
            One-time
          </button>
          <button
            type="button"
            onClick={() => setType("monthly")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              type === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Repeat className="size-4" />
            Monthly
          </button>
        </div>

        {/* Amount tiers */}
        <div className="grid grid-cols-2 gap-3">
          {DONATION_TIERS.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selectedCents === tier.amountCents;
            return (
              <button
                key={tier.amountCents}
                type="button"
                onClick={() => setSelectedCents(tier.amountCents)}
                className={cn(
                  "relative flex flex-col items-start gap-1 p-4 rounded-xl border text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 bg-card",
                )}
              >
                {tier.popular && (
                  <Badge className="absolute top-3 right-3 text-xs" variant="secondary">
                    Popular
                  </Badge>
                )}
                <Icon
                  className={cn(
                    "size-5",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="text-xl font-semibold">{tier.label}</span>
                <span className="text-sm text-muted-foreground">
                  {tier.description}
                  {type === "monthly" ? "/mo" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <Separator />

        {/* Perks */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            What you get
          </h3>
          <ul className="space-y-2">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm">
                <Heart className="size-4 text-primary shrink-0" />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleDonate}
          disabled={createCheckout.isPending}
        >
          {createCheckout.isPending
            ? "Redirecting to Stripe..."
            : `Donate €${(selectedCents / 100).toFixed(2)}${type === "monthly" ? "/mo" : ""}`}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Payments are processed securely by Stripe. No card details are stored
          on our servers.
        </p>
      </div>
    </div>
  );
}
