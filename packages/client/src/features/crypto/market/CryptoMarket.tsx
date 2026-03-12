import { MarketOverview } from "./components/MarketOverview";
import { TokenList } from "./components/TokenList";
import { NewsFeed } from "./components/NewsFeed";
import { Watchlist } from "./components/Watchlist";
import { ActiveEvents } from "./components/ActiveEvents";
import { IpoBanner } from "./components/IpoBanner";

export function CryptoMarket() {
  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-5 pb-16">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        {/* Page header + market stats */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-bold tracking-tight">Overview</h1>
          </div>
          <MarketOverview />
        </div>

        {/* Alerts */}
        <IpoBanner />
        <ActiveEvents />

        {/* Main content */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <TokenList />
          <div className="space-y-5 lg:sticky lg:top-5 lg:self-start">
            <Watchlist />
            <NewsFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
