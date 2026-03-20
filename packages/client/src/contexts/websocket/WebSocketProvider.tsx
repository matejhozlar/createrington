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
  WebSocketStats,
  WebSocketContextType,
} from "./types";
import { WebSocketContext } from "./context";

interface WebSocketProviderProps {
  children: React.ReactNode;
  config?: WebSocketConfig;
}

/**
 * WebSocket Provider
 *
 * Manages WebSocket connection and provides real-time data to the app
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Event subscription system
 * - Graceful error handling
 * - Cleanup on unmount
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  config = {},
}) => {
  // Socket instance (in state for context value)
  const [socket, setSocket] = useState<Socket | null>(null);

  // Connection state
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<WebSocketStats>({
    connectedAt: null,
    reconnectAttempts: 0,
    latency: null,
  });

  // Event listeners registry
  const eventListenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(
    new Map(),
  );

  // Reconnection state
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = config.maxReconnectAttempts ?? 5;
  const reconnectDelay = config.reconnectDelay ?? 1000;

  // Connect function ref (to break circular dependency)
  const connectRef = useRef<(() => void) | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  // ============================================================================
  // Event Management (defined early to avoid hoisting issues)
  // ============================================================================

  /**
   * Emit event to registered listeners
   */
  const emitToListeners = useCallback((event: string, data: unknown) => {
    const listeners = eventListenersRef.current.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          if (import.meta.env.DEV)
            console.error(`Error in event listener for ${event}:`, err);
        }
      });
    }
  }, []);

  /**
   * Subscribe to WebSocket event
   */
  const on = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      if (!eventListenersRef.current.has(event)) {
        eventListenersRef.current.set(event, new Set());
      }

      eventListenersRef.current
        .get(event)!
        .add(callback as (data: unknown) => void);

      // If socket exists, also register with socket.io
      if (socket) {
        socket.on(event, callback);
      }

      // Return unsubscribe function
      return () => {
        const listeners = eventListenersRef.current.get(event);
        if (listeners) {
          listeners.delete(callback as (data: unknown) => void);
          if (listeners.size === 0) {
            eventListenersRef.current.delete(event);
          }
        }

        if (socket) {
          socket.off(event, callback);
        }
      };
    },
    [socket],
  );

  /**
   * Unsubscribe from WebSocket event
   */
  const off = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      const listeners = eventListenersRef.current.get(event);
      if (listeners) {
        listeners.delete(callback as (data: unknown) => void);
        if (listeners.size === 0) {
          eventListenersRef.current.delete(event);
        }
      }

      if (socket) {
        socket.off(event, callback);
      }
    },
    [socket],
  );

  /**
   * Emit event to server
   */
  const emit = useCallback(
    (event: string, data?: unknown, callback?: (response: unknown) => void) => {
      if (!socket?.connected) {
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

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Handle reconnection with exponential backoff
   */
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      if (import.meta.env.DEV)
        console.error("Max reconnection attempts reached");
      setConnectionState("error");
      setError(new Error("Failed to reconnect after multiple attempts"));
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;

    if (import.meta.env.DEV) {
      console.log(
        `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
      );
    }

    setConnectionState("reconnecting");
    setStats((prev) => ({
      ...prev,
      reconnectAttempts: reconnectAttemptsRef.current,
    }));

    reconnectTimeoutRef.current = setTimeout(() => {
      // Use ref to call connect
      connectRef.current?.();
    }, delay);
  }, [maxReconnectAttempts, reconnectDelay]);

  /**
   * Initialize WebSocket connection
   */
  const connect = useCallback(() => {
    if (socket?.connected) {
      if (import.meta.env.DEV) console.warn("WebSocket already connected");
      return;
    }

    const serverUrl = config.url || window.location.origin;
    const path = config.path || "/socket.io";

    if (import.meta.env.DEV)
      console.log("Connecting to WebSocket server:", serverUrl);
    setConnectionState("connecting");
    setError(null);

    // Create socket instance
    const newSocket = io(serverUrl, {
      path,
      transports: config.transports || ["websocket", "polling"],
      reconnection: false, // We handle reconnection manually
      timeout: config.timeout || 10000,
    });

    setSocket(newSocket);

    // Connection successful
    newSocket.on("connect", () => {
      if (import.meta.env.DEV)
        console.log("WebSocket connected:", newSocket.id);
      setConnectionState("connected");
      setError(null);
      reconnectAttemptsRef.current = 0;
      setStats((prev) => ({
        ...prev,
        connectedAt: new Date(),
        reconnectAttempts: 0,
      }));

      // Emit custom event
      emitToListeners("connect", { socketId: newSocket.id });
    });

    // Connection error
    newSocket.on("connect_error", (err) => {
      if (import.meta.env.DEV)
        console.error("WebSocket connection error:", err);
      setError(err);
      setConnectionState("error");
      handleReconnect();
    });

    // Disconnection
    newSocket.on("disconnect", (reason) => {
      if (import.meta.env.DEV) console.log("WebSocket disconnected:", reason);
      setConnectionState("disconnected");
      setStats((prev) => ({
        ...prev,
        connectedAt: null,
      }));

      // Emit custom event
      emitToListeners("disconnect", { reason });

      // Only reconnect if not a manual disconnect
      if (reason !== "io client disconnect") {
        handleReconnect();
      }
    });

    // Generic error
    newSocket.on("error", (err) => {
      if (import.meta.env.DEV) console.error("WebSocket error:", err);
      setError(err);
      emitToListeners("error", err);
    });

    // Pong response for latency measurement
    newSocket.on("pong", (latency: number) => {
      setStats((prev) => ({
        ...prev,
        latency,
      }));
    });

    return newSocket;
  }, [config, emitToListeners, handleReconnect, socket?.connected]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socket) {
      socket.disconnect();
      setSocket(null);
    }

    setConnectionState("disconnected");
    setStats({
      connectedAt: null,
      reconnectAttempts: 0,
      latency: null,
    });
  }, [socket]);

  // Update connect ref when connect changes
  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
  }, [connect, disconnect]);

  /**
   * Check connection health (send ping)
   */
  const ping = useCallback(() => {
    if (socket?.connected) {
      const start = Date.now();
      socket.emit("ping", () => {
        const latency = Date.now() - start;
        setStats((prev) => ({
          ...prev,
          latency,
        }));
      });
    }
  }, [socket]);

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Subscribe to data stream
   */
  const subscribe = useCallback(
    (
      type: SubscriptionType,
      serverId?: number,
    ): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket?.connected) {
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

  /**
   * Unsubscribe from data stream
   */
  const unsubscribe = useCallback(
    (
      type: SubscriptionType,
      serverId?: number,
    ): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket?.connected) {
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

  /**
   * Request initial data
   */
  const requestInitialData = useCallback(
    (
      serverId?: number,
      options?: { includeMessages?: boolean; messageLimit?: number },
    ): Promise<InitialDataPayload | ServerInitialDataPayload | null> => {
      return new Promise((resolve) => {
        if (!socket?.connected) {
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

  // ============================================================================
  // Lifecycle
  // ============================================================================

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (config.autoConnect !== false) {
      connectRef.current?.();
    }

    return () => {
      disconnectRef.current?.();
    };
  }, [config.autoConnect]); // Only run once on mount/unmount

  // Health check interval
  useEffect(() => {
    if (!config.healthCheckInterval || connectionState !== "connected") {
      return;
    }

    const interval = setInterval(() => {
      ping();
    }, config.healthCheckInterval);

    return () => clearInterval(interval);
  }, [config.healthCheckInterval, connectionState, ping]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: WebSocketContextType = useMemo(
    () => ({
      // Connection state
      socket,
      connectionState,
      error,
      stats,
      isConnected: connectionState === "connected",

      // Connection methods
      connect,
      disconnect,
      ping,

      // Event methods
      on,
      off,
      emit,

      // Subscription methods
      subscribe,
      unsubscribe,
      requestInitialData,
    }),
    [
      socket,
      connectionState,
      error,
      stats,
      connect,
      disconnect,
      ping,
      on,
      off,
      emit,
      subscribe,
      unsubscribe,
      requestInitialData,
    ],
  );

  // eslint-disable-next-line react-hooks/refs -- False positive: value contains state/callbacks, not refs
  return React.createElement(WebSocketContext.Provider, { value }, children);
};
