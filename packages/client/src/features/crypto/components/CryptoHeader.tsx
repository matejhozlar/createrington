import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({
  label,
  children,
  isLoading,
}: {
  label: string;
  children: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-4 w-14" />
      ) : (
        <span className="text-sm font-bold font-mono tabular-nums">
          {children}
        </span>
      )}
    </div>
  );
}

export function CryptoHeader() {
  const { user } = useAuth();

  const { data: balanceData, isLoading: balanceLoading } =
    trpc.user.crypto.balance.useQuery(undefined, {
      enabled: !!user,
    });

  const { data: portfolio, isLoading: portfolioLoading } =
    trpc.user.crypto.portfolio.useQuery(undefined, {
      enabled: !!user,
    });

  if (!user) return null;

  const pnl = Number(portfolio?.unrealizedPnl ?? 0);
  const pnlPercent = portfolio?.unrealizedPnlPercent ?? "0";
  const isPositive = pnl >= 0;
  const hasPortfolio =
    !portfolioLoading && portfolio && Number(portfolio.totalValue) > 0;

  return (
    <div className="sticky top-0 z-30 border-b border-border/40 bg-sidebar">
      <div className="px-5 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-end min-h-10 py-1.5">
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
            <Stat label="Balance" isLoading={balanceLoading}>
              $
              {Number(balanceData?.balance ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </Stat>

            <div className="hidden sm:block h-3.5 w-px bg-border/80" />

            <Stat label="Portfolio" isLoading={portfolioLoading}>
              $
              {Number(portfolio?.totalValue ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </Stat>

            {hasPortfolio && (
              <div
                className={cn(
                  "flex items-center gap-0.5 text-xs font-mono font-semibold tabular-nums",
                  isPositive ? "text-emerald-400" : "text-red-400",
                )}
              >
                {isPositive ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {isPositive ? "+" : ""}
                {pnlPercent}%
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
