import React, { useCallback, useEffect, useState, useContext } from "react";
import type {
  CryptoPriceUpdatePayload,
  CryptoPriceBroadcast,
  CryptoMarketOverview,
  CryptoOrderUpdatePayload,
  SubscriptionType,
} from "@createrington/shared/socket";
import { WebSocketContext } from "@/contexts/websocket";
import { useAuth } from "@/contexts/auth";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import type { CryptoDataContextType } from "./types";
import { CryptoDataContext } from "./context";

interface CryptoDataProviderProps {
  children: React.ReactNode;
  /** Auto-subscribe to crypto price updates */
  autoSubscribe?: boolean;
}

/**
 * Crypto Data Provider
 *
 * Manages real-time crypto market data delivered over WebSocket:
 * - Subscribes to the `crypto:market` room on connect (when autoSubscribe is enabled)
 * - Receives an immediate snapshot of all token prices + market overview on subscribe
 * - Maintains a live price map keyed by token symbol
 * - Maintains a live market overview (market cap, volume, top movers)
 * - Listens for order fill events and shows toasts + invalidates relevant queries
 * - Listens for market event broadcasts and reflects them in active-events / news-feed queries
 * - Unsubscribes from the WebSocket room on unmount
 *
 * NOTE: Must be rendered inside WebSocketProvider — throws if the context is missing
 */
export const CryptoDataProvider: React.FC<CryptoDataProviderProps> = ({
  children,
  autoSubscribe = true,
}) => {
  const websocketContext = useContext(WebSocketContext);

  if (!websocketContext) {
    throw new Error("CryptoDataProvider must be used within WebSocketProvider");
  }

  const { isConnected, on, subscribe, unsubscribe } = websocketContext;
  const { user } = useAuth();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [prices, setPrices] = useState<Map<string, CryptoPriceUpdatePayload>>(
    new Map(),
  );
  const [overview, setOverview] = useState<CryptoMarketOverview | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  /** Merges an incoming batch of price updates into the live price map */
  const handlePriceBroadcast = useCallback((raw: unknown) => {
    const data = raw as CryptoPriceBroadcast;
    setPrices((prev) => {
      const updated = new Map(prev);
      for (const update of data.prices) {
        updated.set(update.symbol, update);
      }
      return updated;
    });
    setOverview(data.overview);
  }, []);

  /** Subscribes to the `crypto:market` WebSocket room and marks the provider as subscribed */
  const subscribeToUpdates = useCallback(async () => {
    try {
      await subscribe("crypto:market" as SubscriptionType);
      setIsSubscribed(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Failed to subscribe to crypto updates:", err);
    }
  }, [subscribe]);

  /** Unsubscribes from the `crypto:market` WebSocket room and clears the subscribed flag */
  const unsubscribeFromUpdates = useCallback(async () => {
    try {
      await unsubscribe("crypto:market" as SubscriptionType);
      setIsSubscribed(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Failed to unsubscribe from crypto updates:", err);
    }
  }, [unsubscribe]);

  /** Returns the latest live price payload for a given token symbol, or undefined if not yet received */
  const getPrice = useCallback(
    (symbol: string): CryptoPriceUpdatePayload | undefined => {
      return prices.get(symbol);
    },
    [prices],
  );

  useEffect(() => {
    if (isConnected && autoSubscribe) {
      subscribe("crypto:market" as SubscriptionType).then(
        () => setIsSubscribed(true),
        (err) => { if (import.meta.env.DEV) console.error("Failed to subscribe to crypto updates:", err); },
      );
    }
  }, [isConnected, autoSubscribe, subscribe]);

  useEffect(() => {
    if (!isConnected) return;

    const unsub = on("update:crypto:prices", handlePriceBroadcast);

    return unsub;
  }, [isConnected, on, handlePriceBroadcast]);

  // Order fill events — invalidate balance, orders, portfolio, and trade history
  useEffect(() => {
    if (!isConnected || !user) return;

    const unsub = on("update:crypto:order", (data) => {
      const payload = data as CryptoOrderUpdatePayload & {
        playerUuid?: string;
      };
      if (payload.playerUuid !== user.minecraftUuid) return;

      toast.success(
        `Order #${payload.orderId} ${payload.status}${payload.filledPrice ? ` at $${Number(payload.filledPrice).toFixed(4)}` : ""}`,
      );
      utils.user.crypto.balance.invalidate();
      utils.user.crypto.listOrders.invalidate();
      utils.user.crypto.portfolio.invalidate();
      utils.user.crypto.tradeHistory.invalidate();
    });

    return unsub;
  }, [isConnected, on, user, toast, utils]);

  // Market events — invalidate active events + news feed
  useEffect(() => {
    if (!isConnected) return;

    const unsub = on("crypto:market:event", (data) => {
      const payload = data as {
        id: number;
        type: string;
        title: string;
        severity: string;
        tokenSymbol?: string;
        activeUntil?: string;
      };

      utils.public.crypto.activeEvents.invalidate();
      utils.public.crypto.newsFeed.invalidate();

      const message = payload.tokenSymbol
        ? `${payload.title} [${payload.tokenSymbol}]`
        : payload.title;

      if (payload.severity === "critical") {
        toast.error(message);
      } else if (payload.severity === "warning") {
        toast.warning(message);
      } else {
        toast.info(message);
      }
    });

    return unsub;
  }, [isConnected, on, toast, utils]);

  useEffect(() => {
    return () => {
      if (isSubscribed) {
        unsubscribeFromUpdates();
      }
    };
  }, [isSubscribed, unsubscribeFromUpdates]);

  const value: CryptoDataContextType = {
    prices,
    overview,
    isSubscribed,
    getPrice,
    subscribeToUpdates,
    unsubscribeFromUpdates,
  };

  return React.createElement(CryptoDataContext.Provider, { value }, children);
};
