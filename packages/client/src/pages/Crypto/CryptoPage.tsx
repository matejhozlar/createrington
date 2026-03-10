import { MarketOverview } from "./components/MarketOverview";
import { TokenList } from "./components/TokenList";
import { NewsFeed } from "./components/NewsFeed";
import { Watchlist } from "./components/Watchlist";
import { ActiveEvents } from "./components/ActiveEvents";
import { IpoBanner } from "./components/IpoBanner";

/** Main crypto market page — shows the IPO banner, market overview, active events, token list, watchlist, and news feed. */
export function CryptoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Crypto Market</h1>
        <p className="text-muted-foreground">
          Trade fictional tokens using your in-game balance
        </p>
      </div>

      <IpoBanner />

      <ActiveEvents />

      <MarketOverview />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <TokenList />
        <div className="space-y-6">
          <Watchlist />
          <NewsFeed />
        </div>
      </div>
    </div>
  );
}
