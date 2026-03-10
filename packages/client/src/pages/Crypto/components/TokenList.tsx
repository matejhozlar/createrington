import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading-spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skull } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  stable: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  blue_chip: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  memecoin: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  seasonal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const CATEGORY_LABELS: Record<string, string> = {
  stable: "Stable",
  blue_chip: "Blue Chip",
  memecoin: "Memecoin",
  seasonal: "Seasonal",
};

type CategoryFilter = "all" | "stable" | "blue_chip" | "memecoin" | "seasonal";

export function TokenList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const { data: tokens, isLoading } = trpc.public.crypto.list.useQuery(
    filter === "all"
      ? { includesCrashed: true }
      : { category: filter, includesCrashed: true },
    { refetchInterval: 30_000 },
  );

  if (isLoading) {
    return <Loading mode="inline" size="large" text="Loading tokens..." className="py-12" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(
          [
            ["all", "All"],
            ["stable", "Stable"],
            ["blue_chip", "Blue Chip"],
            ["memecoin", "Memecoin"],
            ["seasonal", "Seasonal"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Token</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Supply</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens?.map((token) => (
              <TableRow
                key={token.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50",
                  token.isCrashed && "opacity-50",
                )}
                onClick={() => navigate(`/crypto/${token.symbol}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {token.isCrashed && (
                      <Skull className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{token.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {token.symbol}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      CATEGORY_COLORS[token.category],
                    )}
                  >
                    {CATEGORY_LABELS[token.category]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatPrice(token.price)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground font-mono">
                  {formatSupply(token.availableSupply, token.totalSupply)}
                </TableCell>
                <TableCell className="text-right">
                  {token.isCrashed ? (
                    <Badge variant="destructive" className="text-xs">
                      Crashed
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs text-emerald-400 border-emerald-500/20"
                    >
                      Active
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!tokens || tokens.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No tokens found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatPrice(price: string): string {
  const num = Number(price);
  if (num === 0) return "0.00";
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatSupply(available: string, total: string): string {
  const avail = Number(available);
  const tot = Number(total);
  if (tot >= 999999999) return "∞";
  const percent = ((1 - avail / tot) * 100).toFixed(1);
  return `${percent}% held`;
}
