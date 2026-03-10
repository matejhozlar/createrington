import { MarketOverview } from "./components/MarketOverview";
import { TokenList } from "./components/TokenList";
import { NewsFeed } from "./components/NewsFeed";
import { Watchlist } from "./components/Watchlist";
import { ActiveEvents } from "./components/ActiveEvents";
import { IpoBanner } from "./components/IpoBanner";
import { Coins } from "lucide-react";

export function CryptoPage() {
  return (
    <div className="flex flex-1 flex-col pb-16">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-emerald-500/[0.02]" />
        <div className="absolute -top-24 -right-24 size-64 rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="relative px-5 md:px-8 pt-10 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <Coins className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Crypto Market
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Trade fictional tokens using your in-game balance
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 pt-8">
        <div className="max-w-7xl mx-auto crypto-stagger space-y-8">
          <IpoBanner />
          <ActiveEvents />
          <MarketOverview />

          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <TokenList />
            <div className="space-y-6">
              <Watchlist />
              <NewsFeed />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
