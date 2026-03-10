import { MarketOverview } from "./components/MarketOverview";
import { TokenList } from "./components/TokenList";

export function CryptoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Crypto Market</h1>
        <p className="text-muted-foreground">
          Trade fictional tokens using your in-game balance
        </p>
      </div>

      <MarketOverview />
      <TokenList />
    </div>
  );
}
