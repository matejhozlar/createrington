import React, { useCallback, useEffect, useState, useContext } from "react";
import type {
  CryptoPriceUpdatePayload,
  SubscriptionType,
} from "@createrington/shared/socket";
import { WebSocketContext } from "@/contexts/websocket";
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
 * Manages real-time crypto price data from WebSocket.
 * Subscribes to CRYPTO_MARKET room and stores live prices in state.
 * Components use the `getPrice` method to overlay live prices on top of tRPC data.
 */
export const CryptoDataProvider: React.FC<CryptoDataProviderProps> = ({
  children,
  autoSubscribe = true,
}) => {
  const websocketContext = useContext(WebSocketContext);

  if (!websocketContext) {
    throw new Error(
      "CryptoDataProvider must be used within WebSocketProvider",
    );
  }

  const { isConnected, on, subscribe, unsubscribe } = websocketContext;

  const [prices, setPrices] = useState<
    Map<string, CryptoPriceUpdatePayload>
  >(new Map());
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Handle price updates from WebSocket
  const handlePriceUpdate = useCallback(
    (payload: CryptoPriceUpdatePayload[]) => {
      setPrices((prev) => {
        const updated = new Map(prev);
        for (const update of payload) {
          updated.set(update.symbol, update);
        }
        return updated;
      });
    },
    [],
  );

  // Subscribe to crypto market updates
  const subscribeToUpdates = useCallback(async () => {
    try {
      await subscribe("crypto:market" as SubscriptionType);
      setIsSubscribed(true);
    } catch (err) {
      console.error("Failed to subscribe to crypto updates:", err);
    }
  }, [subscribe]);

  // Unsubscribe from crypto market updates
  const unsubscribeFromUpdates = useCallback(async () => {
    try {
      await unsubscribe("crypto:market" as SubscriptionType);
      setIsSubscribed(false);
    } catch (err) {
      console.error("Failed to unsubscribe from crypto updates:", err);
    }
  }, [unsubscribe]);

  // Get price for a symbol
  const getPrice = useCallback(
    (symbol: string): CryptoPriceUpdatePayload | undefined => {
      return prices.get(symbol);
    },
    [prices],
  );

  // Auto-subscribe on connect
  useEffect(() => {
    if (isConnected && autoSubscribe) {
      subscribeToUpdates();
    }
  }, [isConnected, autoSubscribe, subscribeToUpdates]);

  // Listen for price update events
  useEffect(() => {
    if (!isConnected) return;

    const unsub = on("update:crypto:prices", (data) => {
      handlePriceUpdate(data as CryptoPriceUpdatePayload[]);
    });

    return unsub;
  }, [isConnected, on, handlePriceUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSubscribed) {
        unsubscribeFromUpdates();
      }
    };
  }, [isSubscribed, unsubscribeFromUpdates]);

  const value: CryptoDataContextType = {
    prices,
    isSubscribed,
    getPrice,
    subscribeToUpdates,
    unsubscribeFromUpdates,
  };

  return React.createElement(CryptoDataContext.Provider, { value }, children);
};
