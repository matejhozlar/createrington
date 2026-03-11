import { MarketOverview } from "./components/MarketOverview";
import { TokenList } from "./components/TokenList";
import { NewsFeed } from "./components/NewsFeed";
import { Watchlist } from "./components/Watchlist";
import { ActiveEvents } from "./components/ActiveEvents";
import { IpoBanner } from "./components/IpoBanner";

export function CryptoMarket() {
  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-4 pb-16">
      <div className="max-w-7xl mx-auto w-full crypto-stagger space-y-4">
        <IpoBanner />
        <ActiveEvents />
        <MarketOverview />

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <TokenList />
          <div className="space-y-4">
            <Watchlist />
            <NewsFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
