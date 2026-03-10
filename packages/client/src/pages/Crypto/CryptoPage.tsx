import { MarketOverview } from "./components/MarketOverview";
import { TokenList } from "./components/TokenList";
import { NewsFeed } from "./components/NewsFeed";
import { Watchlist } from "./components/Watchlist";
import { ActiveEvents } from "./components/ActiveEvents";
import { IpoBanner } from "./components/IpoBanner";

export function CryptoPage() {
  return (
    <div className="flex flex-1 flex-col pb-16">
      <div className="px-5 md:px-8 pt-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold">Crypto Market</h1>
          <p className="mt-2 text-muted-foreground">
            Trade fictional tokens using your in-game balance
          </p>
        </div>
      </div>

      <div className="px-5 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <IpoBanner />
          <ActiveEvents />
          <MarketOverview />

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
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
