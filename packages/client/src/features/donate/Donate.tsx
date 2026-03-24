import { useState } from "react";
import { Heart, Repeat, Zap, CalendarX, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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

const FAQ = [
  {
    question: "Where does my money go?",
    answer:
      "Your donations go directly towards server hosting costs, infrastructure, and development to keep Createrington running and improving.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes, you can cancel your monthly subscription at any time from this page or through Stripe directly via the link in your payment receipt email. Your perks will remain active until the end of the current billing period.",
  },
  {
    question: "Will I get a receipt?",
    answer:
      "Yes, Stripe automatically sends a receipt to the email address associated with your payment method after each successful payment.",
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept all major credit and debit cards through Stripe, including Visa, Mastercard, and American Express.",
  },
  {
    question: "What currency will I be charged in?",
    answer:
      "Prices are listed in EUR. If your card uses a different currency, your bank will convert it at their current exchange rate.",
  },
  {
    question: "Do I get any in-game advantages?",
    answer:
      "No. Donations are purely to support the server. You'll receive a Supporter role on Discord as a thank you, but no gameplay advantages.",
  },
  {
    question: "Can I donate anonymously?",
    answer:
      "Your Discord account is linked to the donation for role assignment, but your donation details are not shared publicly.",
  },
  {
    question: "What data do you store?",
    answer:
      "We store your Discord ID, donation amount, and Stripe session and subscription IDs. All payment details (card number, billing address, etc.) are handled entirely by Stripe — we never see or store them.",
  },
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

  const history = trpc.user.donations.history.useQuery();
  const subscription = trpc.user.donations.activeSubscription.useQuery();

  const isSupporter =
    history.data?.some((d) => d.status === "completed") ?? false;
  const cancelSubscription = trpc.user.donations.cancelSubscription.useMutation(
    {
      onSuccess: () => {
        toast.success(
          "Subscription cancelled",
          "Your subscription will end at the end of the current billing period.",
        );
        subscription.refetch();
      },
      onError: (err) => {
        toast.error("Failed to cancel subscription", err.message);
      },
    },
  );

  const reactivateSubscription =
    trpc.user.donations.reactivateSubscription.useMutation({
      onSuccess: () => {
        toast.success(
          "Subscription reactivated",
          "Your subscription will continue as normal.",
        );
        subscription.refetch();
      },
      onError: (err) => {
        toast.error("Failed to reactivate subscription", err.message);
      },
    });

  const createCheckout = trpc.user.donations.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      if (!new URL(url).hostname.endsWith("stripe.com")) return;
      window.location.href = url;
    },
    onError: (err) => {
      toast.error("Failed to start checkout", err.message);
    },
  });

  const donationCents = isCustom
    ? Math.round(Number(customValue) * 100)
    : selectedCents;
  const isValidAmount = donationCents >= 100 && donationCents <= 100_000;

  function handleDonate() {
    if (!isValidAmount) {
      toast.error(
        "Invalid amount",
        "Please enter an amount between €1 and €1,000",
      );
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
        {/* Active subscription banner */}
        {subscription.data && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  Active monthly subscription
                </h3>
                <p className="text-sm text-muted-foreground">
                  €{(subscription.data.amountCents / 100).toFixed(2)}/mo
                  {subscription.data.cancelAtPeriodEnd
                    ? ` — cancels on ${new Date(subscription.data.currentPeriodEnd).toLocaleDateString()}`
                    : ` — renews on ${new Date(subscription.data.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              </div>
              {subscription.data.cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reactivateSubscription.mutate()}
                  disabled={reactivateSubscription.isPending}
                >
                  {reactivateSubscription.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Repeat className="size-4" />
                  )}
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelSubscription.mutate()}
                  disabled={cancelSubscription.isPending}
                >
                  {cancelSubscription.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarX className="size-4" />
                  )}
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Supporter thank you */}
        {isSupporter && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-3">
              <Heart className="size-5 text-primary shrink-0" />
              <p className="text-sm font-medium text-foreground">
                Thank you for being a supporter!
              </p>
            </div>
          </div>
        )}

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
                {tier.label}
                {type === "monthly" ? "/mo" : ""}
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
          Prices shown in EUR. Your local currency equivalent will be shown at
          checkout.
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

        {/* Donation history */}
        {history.data && history.data.length > 0 && (
          <>
            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Your donation history
              </h3>
              <div className="space-y-2">
                {history.data.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {d.type === "monthly" ? (
                        <Repeat className="size-4 text-muted-foreground" />
                      ) : (
                        <Zap className="size-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          €{(d.amountCents / 100).toFixed(2)}
                          {d.type === "monthly" ? "/mo" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(d.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        d.status === "completed" &&
                          "border-green-500/30 text-green-500",
                        d.status === "pending" &&
                          "border-yellow-500/30 text-yellow-500",
                        d.status === "refunded" &&
                          "border-blue-500/30 text-blue-500",
                        d.status === "cancelled" &&
                          "border-muted-foreground/30 text-muted-foreground",
                      )}
                    >
                      {d.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* FAQ */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Frequently asked questions
          </h3>
          <Accordion type="single" collapsible>
            {FAQ.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
