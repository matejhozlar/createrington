import { useCallback, useEffect, useState } from "react";
import type {
  InitialDataPayload,
  SocketEvent,
  SubscriptionType,
} from "@createrington/shared/socket";
import { useWebSocket } from "./use-websocket";

interface RealtimeFeedOptions<TUpdate> {
  type: SubscriptionType;
  event: SocketEvent;
  onSnapshot: (snapshot: InitialDataPayload) => void;
  onUpdate: (payload: TUpdate) => void;
}

interface RealtimeFeed {
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("Failed to load realtime data");
}

export function useRealtimeFeed<TUpdate>({
  type,
  event,
  onSnapshot,
  onUpdate,
}: RealtimeFeedOptions<TUpdate>): RealtimeFeed {
  const { isConnected, on, subscribe, unsubscribe, requestSnapshot } =
    useWebSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    let active = true;
    requestSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setError(null);
        if (snapshot) onSnapshot(snapshot);
      })
      .catch((error: unknown) => {
        if (active) setError(toError(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    void subscribe(type);
    const off = on(event, (data) => onUpdate(data as TUpdate));

    return () => {
      active = false;
      off();
      void unsubscribe(type);
    };
  }, [
    isConnected,
    type,
    event,
    on,
    subscribe,
    unsubscribe,
    requestSnapshot,
    onSnapshot,
    onUpdate,
  ]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await requestSnapshot(true);
      if (snapshot) onSnapshot(snapshot);
    } catch (error) {
      setError(toError(error));
    } finally {
      setLoading(false);
    }
  }, [requestSnapshot, onSnapshot]);

  return { loading, error, refresh };
}
