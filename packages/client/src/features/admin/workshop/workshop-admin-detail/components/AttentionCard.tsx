import type { RouterOutput } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardError } from "@/features/admin/components/CardState";

type AttentionItem = RouterOutput["admin"]["workshops"]["getAttention"][number];

// The dependency types render inline because they name a second mod
type SimpleAttention = Exclude<
  AttentionItem["type"],
  "rejected_dependency" | "unpromoted_dependency"
>;

const ATTENTION_MESSAGES: Record<SimpleAttention, string> = {
  dropped_from_pack: "was live but is missing from the latest published pack.",
  shipped_unreviewed:
    "shipped in the pack but its suggestion never finished review, so the suggester is uncredited.",
  shipped_rejected: "shipped in the pack but is rejected in this workshop.",
};

export function AttentionCard({
  items,
  error,
  onRetry,
}: {
  items: AttentionItem[];
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <Card className="gap-0">
        <CardHeader className="gap-0 border-b">
          <CardTitle>Needs Attention</CardTitle>
        </CardHeader>
        <CardError message={error} onRetry={onRetry} />
      </Card>
    );
  }

  if (items.length === 0) return null;

  return (
    <Card className="gap-0 border-amber-500/40">
      <CardHeader className="gap-0 border-b">
        <CardTitle>Needs Attention ({items.length.toLocaleString()})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-6">
        {items.map((item) => (
          <p
            key={`${item.type}-${item.curseforgeProjectId}`}
            className="text-sm text-muted-foreground"
          >
            <span className="font-medium text-foreground">{item.name}</span>{" "}
            {item.type === "rejected_dependency" ||
            item.type === "unpromoted_dependency" ? (
              <>
                is required by{" "}
                <span className="font-medium text-foreground">
                  {item.requiredByName}
                </span>{" "}
                {item.type === "rejected_dependency"
                  ? "but is rejected in this workshop."
                  : "but has not reached the pack yet, so the pack is missing it."}
              </>
            ) : (
              ATTENTION_MESSAGES[item.type]
            )}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
