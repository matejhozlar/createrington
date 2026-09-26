import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import type {
  InitialDataPayload,
  ServerInitialDataPayload,
  SubscriptionType,
  SocketEvent,
} from "@createrington/shared/socket";
import type {
  WebSocketConfig,
  ConnectionState,
  WebSocketContextType,
} from "./types";
import { WebSocketContext } from "./context";
import { useAuth } from "@/contexts/auth";
import { getAccessToken } from "@/services/auth/token-manager";

interface WebSocketProviderProps {
  children: React.ReactNode;
  config?: WebSocketConfig;
}

function createSocket(config: WebSocketConfig): Socket {
  return io(config.url || window.location.origin, {
    path: config.path || "/socket.io",
    transports: config.transports || ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: config.reconnectionDelay ?? 1000,
    reconnectionDelayMax: config.reconnectionDelayMax ?? 30000,
    timeout: config.timeout || 10000,
    auth: (cb) => {
      const token = getAccessToken();
      cb(token ? { token } : {});
    },
  });
}

export function WebSocketProvider({
  children,
  config = {},
}: WebSocketProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const autoConnect = config.autoConnect !== false;

  const [socket] = useState(() => createSocket(config));
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    autoConnect ? "connecting" : "disconnected",
  );
  const [error, setError] = useState<Error | null>(null);
  const rejectedRetryRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const cancelRejectedRetry = useCallback(() => {
    clearTimeout(rejectedRetryRef.current);
    rejectedRetryRef.current = undefined;
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      setConnectionState("connected");
      setError(null);
    };
    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      if (import.meta.env.DEV) console.log("WebSocket disconnected:", reason);
      setConnectionState(socket.active ? "reconnecting" : "disconnected");
    };
    const handleConnectError = (err: Error) => {
      if (import.meta.env.DEV)
        console.error("WebSocket connection error:", err);
      setError(err);
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
    if (!autoConnect || authLoading) return;

    socket.connect();

    return () => {
      cancelRejectedRetry();
      socket.disconnect();
    };
  }, [socket, autoConnect, authLoading, cancelRejectedRetry]);

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

    if (!autoConnect) return;
    cancelRejectedRetry();
    socket.disconnect().connect();
  }, [socket, authLoading, user?.discordId, autoConnect, cancelRejectedRetry]);

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

  const connect = useCallback(() => {
    if (socket.connected) return;
    cancelRejectedRetry();
    setConnectionState("connecting");
    socket.connect();
  }, [socket, cancelRejectedRetry]);

  const disconnect = useCallback(() => {
    cancelRejectedRetry();
    socket.disconnect();
  }, [socket, cancelRejectedRetry]);

  const on = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      socket.on(event, callback);
      return () => {
        socket.off(event, callback);
      };
    },
    [socket],
  );

  const off = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      socket.off(event, callback);
    },
    [socket],
  );

  const emit = useCallback(
    (event: string, data?: unknown, callback?: (response: unknown) => void) => {
      if (!socket.connected) {
        if (import.meta.env.DEV)
          console.warn("Cannot emit: WebSocket not connected");
        return false;
      }

      if (callback) {
        socket.emit(event, data, callback);
      } else {
        socket.emit(event, data);
      }

      return true;
    },
    [socket],
  );

  const subscribe = useCallback(
    (
      type: SubscriptionType,
      serverId?: number,
    ): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket.connected) {
          resolve({ success: false, error: "Not connected" });
          return;
        }

        socket.emit(
          "subscribe" as SocketEvent,
          { type, serverId },
          (response: { success: boolean; error?: string }) => {
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
    ): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket.connected) {
          resolve({ success: false, error: "Not connected" });
          return;
        }

        socket.emit(
          "unsubscribe" as SocketEvent,
          { type, serverId },
          (response: { success: boolean; error?: string }) => {
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

        socket.emit(
          "request:initial" as SocketEvent,
          {
            serverId,
            includeMessages: options?.includeMessages ?? true,
            messageLimit: options?.messageLimit ?? 50,
          },
          (data: InitialDataPayload | ServerInitialDataPayload) => {
            if (import.meta.env.DEV) {
              console.log(
                `Received initial data${serverId ? ` for server ${serverId}` : ""}`,
              );
            }
            resolve(data);
          },
        );
      });
    },
    [socket],
  );

  const value: WebSocketContextType = useMemo(
    () => ({
      socket,
      connectionState,
      error,
      isConnected: connectionState === "connected",
      connect,
      disconnect,
      on,
      off,
      emit,
      subscribe,
      unsubscribe,
      requestInitialData,
    }),
    [
      socket,
      connectionState,
      error,
      connect,
      disconnect,
      on,
      off,
      emit,
      subscribe,
      unsubscribe,
      requestInitialData,
    ],
  );

  return React.createElement(WebSocketContext.Provider, { value }, children);
}
