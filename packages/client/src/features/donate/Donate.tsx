import { useState } from "react";
import { Heart, Repeat, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

// =============================================================================
// Static data
// =============================================================================

const DONATION_TIERS = [
  { amountCents: 300, label: "€3" },
  { amountCents: 500, label: "€5" },
  { amountCents: 1000, label: "€10" },
  { amountCents: 1500, label: "€15" },
  { amountCents: 2000, label: "€20" },
  { amountCents: 5000, label: "€50" },
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
  const [selectedCents, setSelectedCents] = useState<number>(500);
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const createCheckout = trpc.user.donations.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => {
      toast.error("Failed to start checkout", err.message);
    },
  });

  const donationCents = isCustom ? Math.round(Number(customValue) * 100) : selectedCents;
  const isValidAmount = donationCents >= 100 && donationCents <= 100_000;

  function handleDonate() {
    if (!isValidAmount) {
      toast.error("Invalid amount", "Please enter an amount between €1 and €1,000");
      return;
    }
    createCheckout.mutate({ type, amountCents: donationCents });
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Support Createrington"
        description="Help keep the server running and make it even better for everyone."
        imageSrc="/assets/hero/gondola-station.webp"
        imageAlt="Createrington gondola station"
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
        <div className="grid grid-cols-3 gap-3">
          {DONATION_TIERS.map((tier) => {
            const isSelected = !isCustom && selectedCents === tier.amountCents;
            return (
              <button
                key={tier.amountCents}
                type="button"
                onClick={() => {
                  setIsCustom(false);
                  setSelectedCents(tier.amountCents);
                }}
                className={cn(
                  "flex items-center justify-center p-4 rounded-xl border text-xl font-semibold transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary text-foreground"
                    : "border-border hover:border-primary/50 bg-card text-muted-foreground",
                )}
              >
                {tier.label}{type === "monthly" ? "/mo" : ""}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={cn(
              "flex items-center justify-center p-4 rounded-xl border text-xl font-semibold transition-all col-span-3",
              isCustom
                ? "border-primary bg-primary/5 ring-1 ring-primary text-foreground"
                : "border-border hover:border-primary/50 bg-card text-muted-foreground",
            )}
          >
            Custom amount
          </button>
        </div>

        {isCustom && (
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold">€</span>
            <input
              type="number"
              min={1}
              max={1000}
              step={1}
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value);
                const cents = Math.round(Number(e.target.value) * 100);
                if (cents >= 100 && cents <= 100_000) setSelectedCents(cents);
              }}
              placeholder="Enter amount (1–1,000)"
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-xl font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Prices shown in EUR. Your local currency equivalent will be shown at checkout.
        </p>

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
          disabled={createCheckout.isPending || (isCustom && !isValidAmount)}
        >
          {createCheckout.isPending
            ? "Redirecting to Stripe..."
            : `Donate €${(donationCents / 100).toFixed(2)}${type === "monthly" ? "/mo" : ""}`}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Payments are processed securely by Stripe. No card details are stored
          on our servers.
        </p>
      </div>
    </div>
  );
}
