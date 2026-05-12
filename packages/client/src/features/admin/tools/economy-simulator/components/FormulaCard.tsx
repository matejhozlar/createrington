import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FORMULA = `new_balance = worth                       if worth <= B
new_balance = B * (worth / B)^alpha       if worth > B

Sliding mode:
  tenure_score = min(1, op_days / tenure_cap_days)
  play_score   = op_era_seconds / max(op_era_seconds)
  alpha        = clamp(alpha_base + w_p * play_score - w_t * tenure_score,
                       alpha_min, alpha_max)

Binary mode:
  alpha = (joined <= cutoff) ? alpha_early : alpha_modern   (then clamped)`;

export function FormulaCard() {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>Formula</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Lower alpha compresses top balances harder; B is the threshold below
          which nothing changes. Hover the help icon next to each parameter for
          a directional explanation.
        </p>
        <pre className="overflow-x-auto whitespace-pre rounded-md bg-muted px-3 py-2 font-mono text-xs">
          {FORMULA}
        </pre>
      </CardContent>
    </Card>
  );
}
