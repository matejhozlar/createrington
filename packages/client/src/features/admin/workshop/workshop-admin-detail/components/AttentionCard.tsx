import type { RouterOutput } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardError, CardLoading } from "@/features/admin/components/CardState";

type AttentionItem = RouterOutput["admin"]["workshops"]["getAttention"][number];

// These render inline because they name a second mod
type DependencyGap = Extract<
  AttentionItem["type"],
  "rejected_dependency" | "unpromoted_dependency" | "missing_dependency"
>;

const DEPENDENCY_GAP_MESSAGES: Record<DependencyGap, string> = {
  rejected_dependency: "but is ruled out in this workshop.",
  unpromoted_dependency:
    "but is still in review, so the pack would ship without it.",
  missing_dependency:
    "but is not in the workshop at all, so it has to be installed by hand when you build the pack.",
};

const ATTENTION_MESSAGES: Record<
  Exclude<AttentionItem["type"], DependencyGap>,
  string
> = {
  dropped_from_pack: "was live but is missing from the latest published pack.",
  shipped_unreviewed:
    "shipped in the pack but its suggestion never finished review, so the suggester is uncredited.",
  shipped_rejected: "shipped in the pack but is rejected in this workshop.",
};

export function AttentionCard({
  items,
  isLoading,
  error,
  onRetry,
}: {
  items: AttentionItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (isLoading || error) {
    return (
      <Card className="gap-0">
        <CardHeader className="gap-0 border-b">
          <CardTitle>Needs Attention</CardTitle>
        </CardHeader>
        {isLoading ? (
          <CardLoading text="Checking for problems..." />
        ) : (
          <CardError message={error!} onRetry={onRetry} />
        )}
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
            item.type === "unpromoted_dependency" ||
            item.type === "missing_dependency" ? (
              <>
                is required by{" "}
                <span className="font-medium text-foreground">
                  {item.requiredByName}
                </span>{" "}
                {DEPENDENCY_GAP_MESSAGES[item.type]}
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
