import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  InitialDataPayload,
  ServerInitialDataPayload,
  SubscriptionType,
} from "@createrington/shared/socket";
import { SocketEvent } from "@createrington/shared/socket";
import type {
  ConnectionState,
  SubscriptionResult,
  WebSocketContextType,
} from "./types";
import { WebSocketContext } from "./context";
import { useAuth } from "@/contexts/auth";
import { getAccessToken } from "@/services/auth/token-manager";

const INITIAL_DATA_TIMEOUT_MS = 10_000;

interface WebSocketProviderProps {
  children: React.ReactNode;
}

function createSocket(): Socket {
  return io(window.location.origin, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
    auth: (cb) => {
      const token = getAccessToken();
      cb(token ? { token } : {});
    },
  });
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user, loading: authLoading } = useAuth();

  const [socket] = useState(createSocket);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const snapshotRef = useRef<Promise<InitialDataPayload | null> | null>(null);
  const rejectedRetryRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const cancelRejectedRetry = useCallback(() => {
    clearTimeout(rejectedRetryRef.current);
    rejectedRetryRef.current = undefined;
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      snapshotRef.current = null;
      setConnectionState("connected");
    };
    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      snapshotRef.current = null;
      if (import.meta.env.DEV) console.log("WebSocket disconnected:", reason);
      setConnectionState(socket.active ? "reconnecting" : "disconnected");
    };
    const handleConnectError = (err: Error) => {
      if (import.meta.env.DEV)
        console.error("WebSocket connection error:", err);
      if (socket.active) {
        setConnectionState("reconnecting");
        return;
      }
      setConnectionState("error");
      cancelRejectedRetry();
      rejectedRetryRef.current = setTimeout(
        () => socket.connect(),
        socket.io.reconnectionDelayMax(),
      );
    };
    const handleReconnectAttempt = () => setConnectionState("reconnecting");

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);

    return () => {
      cancelRejectedRetry();
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
    };
  }, [socket, cancelRejectedRetry]);

  useEffect(() => {
    if (authLoading) return;

    socket.connect();

    return () => {
      cancelRejectedRetry();
      socket.disconnect();
    };
  }, [socket, authLoading, cancelRejectedRetry]);

  const lastIdentityRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading) return;

    const identity = user?.discordId ?? null;
    if (lastIdentityRef.current === undefined) {
      lastIdentityRef.current = identity;
      return;
    }
    if (lastIdentityRef.current === identity) return;
    lastIdentityRef.current = identity;

    cancelRejectedRetry();
    socket.disconnect().connect();
  }, [socket, authLoading, user?.discordId, cancelRejectedRetry]);

  useEffect(() => {
    const retryNow = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.active || socket.connected) return;
      socket.disconnect().connect();
    };

    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", retryNow);

    return () => {
      window.removeEventListener("online", retryNow);
      document.removeEventListener("visibilitychange", retryNow);
    };
  }, [socket]);

  const on = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      socket.on(event, callback);
      return () => {
        socket.off(event, callback);
      };
    },
    [socket],
  );

  const subscribe = useCallback(
    (
      type: SubscriptionType,
      serverId?: number,
    ): Promise<SubscriptionResult> => {
      return new Promise((resolve) => {
        if (!socket.connected) {
          resolve({ success: false, error: "Not connected" });
          return;
        }

        socket.emit(
          SocketEvent.SUBSCRIBE,
          { type, serverId },
          (response: SubscriptionResult) => {
            if (import.meta.env.DEV) {
              if (response.success) {
                console.log(
                  `Subscribed to ${type}${serverId ? ` (server ${serverId})` : ""}`,
                );
              } else {
                console.error(
                  `Failed to subscribe to ${type}:`,
                  response.error,
                );
              }
            }
            resolve(response);
          },
        );
      });
    },
    [socket],
  );

  const unsubscribe = useCallback(
    (
      type: SubscriptionType,
      serverId?: number,
    ): Promise<SubscriptionResult> => {
      return new Promise((resolve) => {
        if (!socket.connected) {
          resolve({ success: false, error: "Not connected" });
          return;
        }

        socket.emit(
          SocketEvent.UNSUBSCRIBE,
          { type, serverId },
          (response: SubscriptionResult) => {
            if (import.meta.env.DEV) {
              if (response.success) {
                console.log(
                  `Unsubscribed from ${type}${serverId ? ` (server ${serverId})` : ""}`,
                );
              } else {
                console.error(
                  `Failed to unsubscribe from ${type}:`,
                  response.error,
                );
              }
            }
            resolve(response);
          },
        );
      });
    },
    [socket],
  );

  const requestInitialData = useCallback(
    (
      serverId?: number,
      options?: { includeMessages?: boolean; messageLimit?: number },
    ): Promise<InitialDataPayload | ServerInitialDataPayload | null> => {
      return new Promise((resolve) => {
        if (!socket.connected) {
          if (import.meta.env.DEV)
            console.warn("Cannot request initial data: Not connected");
          resolve(null);
          return;
        }

        socket.timeout(INITIAL_DATA_TIMEOUT_MS).emit(
          SocketEvent.REQUEST_INITIAL_DATA,
          {
            serverId,
            includeMessages: options?.includeMessages ?? true,
            messageLimit: options?.messageLimit ?? 50,
          },
          (
            error: Error | null,
            data: InitialDataPayload | ServerInitialDataPayload | null,
          ) => {
            if (import.meta.env.DEV) {
              console.log(
                error || !data
                  ? "Initial data request was not answered"
                  : `Received initial data${serverId ? ` for server ${serverId}` : ""}`,
              );
            }
            resolve(error ? null : data);
          },
        );
      });
    },
    [socket],
  );

  const requestSnapshot = useCallback(
    (fresh = false): Promise<InitialDataPayload | null> => {
      if (fresh || !snapshotRef.current) {
        const request = requestInitialData(undefined, {
          includeMessages: false,
        }).then((data) => (data && "servers" in data ? data : null));
        snapshotRef.current = request;
        void request.then((snapshot) => {
          if (!snapshot && snapshotRef.current === request) {
            snapshotRef.current = null;
          }
        });
      }
      return snapshotRef.current;
    },
    [requestInitialData],
  );

  const value: WebSocketContextType = useMemo(
    () => ({
      connectionState,
      isConnected: connectionState === "connected",
      on,
      subscribe,
      unsubscribe,
      requestInitialData,
      requestSnapshot,
    }),
    [
      connectionState,
      on,
      subscribe,
      unsubscribe,
      requestInitialData,
      requestSnapshot,
    ],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
