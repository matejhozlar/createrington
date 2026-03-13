import type {
  CryptoPriceUpdatePayload,
  CryptoMarketOverview,
} from "@createrington/shared/socket";

/**
 * Crypto data context type
 */
export interface CryptoDataContextType {
  /** Live price updates from WebSocket, keyed by symbol */
  prices: Map<string, CryptoPriceUpdatePayload>;
  /** Latest market overview from WebSocket (market cap, volume, top movers) */
  overview: CryptoMarketOverview | null;
  /** Whether we're subscribed to crypto market updates */
  isSubscribed: boolean;

  /** Get the latest price update for a symbol */
  getPrice: (symbol: string) => CryptoPriceUpdatePayload | undefined;
  /** Subscribe to crypto market updates */
  subscribeToUpdates: () => Promise<void>;
  /** Unsubscribe from crypto market updates */
  unsubscribeFromUpdates: () => Promise<void>;
}
