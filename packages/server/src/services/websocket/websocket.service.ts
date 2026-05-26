import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";
import type {
  InitialDataPayload,
  InitialDataRequest,
  MessageUpdatePayload,
  PlayersUpdatePayload,
  ServerInitialDataPayload,
  ServerStatusUpdatePayload,
  SubscriptionConfirmation,
  SubscriptionRequest,
  WebSocketServiceConfig,
  WebSocketStats,
} from "./types";
import { SocketEvent, SubscriptionType } from "./types";
import type { MessageCacheService } from "../discord/message/cache";
import type { PlaytimeManagerService } from "../playtime/playtime-manager.service";
import { RoomManager } from "./room-manager";
import { WebSocketDataProvider } from "./data-provider";
import type { CachedMessage } from "../discord/message/cache";
import type { SessionEndEvent, SessionStartEvent } from "../playtime";
import { jwtService } from "@/services/auth/jwt";
import type { JWTPayload } from "@createrington/shared/auth";

const MAX_CONNECTIONS_PER_IP = 20;
const EVENTS_PER_SOCKET_PER_MIN = 60;

// Mirrors the HTTP gate in server-ip.middleware: nginx terminates on
// loopback and sets X-Real-IP to the real client. Without this the per-IP
// cap would see every proxied socket as 127.0.0.1 and cap the server at 20.
function getSocketClientIp(socket: Socket): string {
  const raw = socket.handshake.address ?? "";
  const peer = raw.startsWith("::ffff:") ? raw.slice(7) : raw;
  if (peer === "127.0.0.1" || peer === "::1") {
    const realIp = socket.handshake.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.length > 0) {
      return realIp.trim();
    }
  }
  return peer || "unknown";
}

/**
 * Real-time channel between the server and web clients, built on Socket.IO. Manages
 * subscription-based rooms (server status, players, messages, crypto market), serves
 * initial state snapshots on demand, and bridges domain events from
 * `MessageCacheService` and each `PlaytimeService` into room broadcasts. The handshake
 * applies a per-IP connection cap (with nginx X-Real-IP awareness) and accepts an
 * optional Bearer token so future per-user rooms can read `socket.data.user`; invalid
 * tokens degrade to anonymous rather than reject. Per-socket event budgets prevent
 * one tab from starving others on the same client. Construction wires the HTTP server
 * and connection handlers; `initialize()` must be called with both dependency
 * services before event-driven broadcasting will fire.
 */
export class WebSocketService {
  private io: SocketIOServer;
  private dataProvider!: WebSocketDataProvider;
  private isInitialized = false;
  private startTime: Date;

  private clientSockets: Map<string, Set<string>> = new Map(); // socketId -> Set<rooms>
  private connectionsByIp: Map<string, number> = new Map();
  private eventBuckets: Map<string, { count: number; windowStart: number }> =
    new Map();

  constructor(
    httpServer: HttpServer,
    private config: WebSocketServiceConfig = {},
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: config.cors || {
        origin: false,
        credentials: true,
      },
      path: config.path || "/socket.io",
    });

    this.startTime = new Date();
    this.setupHandshakeGate();
    this.setupConnectionHandlers();
  }

  private setupHandshakeGate(): void {
    this.io.use((socket, next) => {
      const ip = getSocketClientIp(socket);
      const current = this.connectionsByIp.get(ip) ?? 0;
      if (current >= MAX_CONNECTIONS_PER_IP) {
        logger.warn(
          `[ws] rejecting connection from ${ip}: ${current} concurrent sockets already open`,
        );
        return next(new Error("Too many connections"));
      }

      // Optional auth: unauthenticated sockets are allowed (public data),
      // but when the client passes a Bearer-style token via handshake.auth,
      // verify it so future per-user rooms can read socket.data.user.
      const token =
        typeof socket.handshake.auth?.token === "string"
          ? socket.handshake.auth.token
          : undefined;
      if (token) {
        try {
          socket.data.user = jwtService.verify(token) satisfies JWTPayload;
        } catch {
          // Invalid/expired token: treat as unauthenticated, don't reject.
        }
      }

      next();
    });
  }

  // Returns true if the socket is within its per-minute event budget.
  // Per-socket (not per-IP) so one noisy socket can't starve other tabs from
  // the same client.
  private allowSocketEvent(socketId: string): boolean {
    const now = Date.now();
    const bucket = this.eventBuckets.get(socketId);
    if (!bucket || now - bucket.windowStart >= 60_000) {
      this.eventBuckets.set(socketId, { count: 1, windowStart: now });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= EVENTS_PER_SOCKET_PER_MIN;
  }

  /** Wires data providers and bridges events from the message cache and every per-server playtime service. */
  async initialize(
    messageCacheService: MessageCacheService,
    playtimeManagerService: PlaytimeManagerService,
  ): Promise<void> {
    if (this.isInitialized) {
      logger.warn("WebSocketService already initialized");
      return;
    }

    this.dataProvider = new WebSocketDataProvider(
      messageCacheService,
      playtimeManagerService,
    );

    this.connectToServices(messageCacheService, playtimeManagerService);

    this.isInitialized = true;
    logger.info("WebSocketService initialized");
  }

  private setupConnectionHandlers(): void {
    this.io.on(SocketEvent.CONNECTION, (socket: Socket) => {
      const ip = getSocketClientIp(socket);
      this.connectionsByIp.set(ip, (this.connectionsByIp.get(ip) ?? 0) + 1);
      logger.info(`Client connected: ${socket.id}`);

      this.clientSockets.set(socket.id, new Set());

      socket.on(
        SocketEvent.SUBSCRIBE,
        (request: SubscriptionRequest, callback) => {
          if (!this.allowSocketEvent(socket.id)) {
            logger.warn(`[ws] rate-limited ${socket.id} on subscribe`);
            callback?.({
              type: request.type,
              serverId: request.serverId,
              room: "",
              success: false,
              error: "Rate limited",
            });
            return;
          }
          this.handleSubscribe(socket, request, callback);
        },
      );

      socket.on(
        SocketEvent.UNSUBSCRIBE,
        (request: SubscriptionRequest, callback) => {
          if (!this.allowSocketEvent(socket.id)) {
            logger.warn(`[ws] rate-limited ${socket.id} on unsubscribe`);
            callback?.({
              type: request.type,
              serverId: request.serverId,
              room: "",
              success: false,
              error: "Rate limited",
            });
            return;
          }
          this.handleUnsubscribe(socket, request, callback);
        },
      );

      socket.on(
        SocketEvent.REQUEST_INITIAL_DATA,
        (request: InitialDataRequest, callback) => {
          if (!this.allowSocketEvent(socket.id)) {
            logger.warn(`[ws] rate-limited ${socket.id} on initialDataRequest`);
            // Callback type is data-only; signal via ERROR event instead so
            // the client can detect it without hanging on the ack.
            socket.emit(SocketEvent.ERROR, {
              message: "Rate limited",
              event: SocketEvent.REQUEST_INITIAL_DATA,
            });
            return;
          }
          this.handleInitialDataRequest(socket, request, callback);
        },
      );

      socket.on(SocketEvent.DISCONNECT, () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.clientSockets.delete(socket.id);
        this.eventBuckets.delete(socket.id);
        const remaining = (this.connectionsByIp.get(ip) ?? 1) - 1;
        if (remaining <= 0) {
          this.connectionsByIp.delete(ip);
        } else {
          this.connectionsByIp.set(ip, remaining);
        }
      });

      socket.on(SocketEvent.ERROR, (error: Error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });

    logger.debug("Socket.IO connection handlers registered");
  }

  private async handleSubscribe(
    socket: Socket,
    request: SubscriptionRequest,
    callback?: (response: SubscriptionConfirmation) => void,
  ): Promise<void> {
    try {
      if (
        request.type !== SubscriptionType.ALL &&
        request.serverId === undefined &&
        request.type !== SubscriptionType.SERVER_STATUS &&
        request.type !== SubscriptionType.PLAYERS &&
        request.type !== SubscriptionType.MESSAGES &&
        request.type !== SubscriptionType.CRYPTO_MARKET
      ) {
        throw new Error(`Server ID required for ${request.type} subscription`);
      }

      const rooms = RoomManager.getRoomsForSubscription(
        request.type,
        request.serverId,
      );

      for (const room of rooms) {
        await socket.join(room);
        this.clientSockets.get(socket.id)?.add(room);
      }

      const primaryRoom = rooms[0];

      logger.debug(
        `Client ${socket.id} subscribed to ${request.type}${request.serverId ? ` (server: ${request.serverId})` : ""} - rooms: ${rooms.join(", ")}`,
      );

      const confirmation: SubscriptionConfirmation = {
        type: request.type,
        serverId: request.serverId,
        room: primaryRoom,
        success: true,
      };

      if (callback) {
        callback(confirmation);
      }

      socket.emit(SocketEvent.SUBSCRIBED, confirmation);

      // Push immediate price snapshot so client doesn't wait for the next tick
      if (request.type === SubscriptionType.CRYPTO_MARKET) {
        this.sendCryptoInitialSnapshot(socket).catch((err) =>
          logger.error(
            `Failed to send crypto initial snapshot to ${socket.id}:`,
            err,
          ),
        );
      }
    } catch (error) {
      logger.error(
        `Failed to subscribe client ${socket.id} to ${request.type}:`,
        error,
      );

      const confirmation: SubscriptionConfirmation = {
        type: request.type,
        serverId: request.serverId,
        room: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      if (callback) {
        callback(confirmation);
      }
    }
  }

  private async sendCryptoInitialSnapshot(socket: Socket): Promise<void> {
    const { getService: getSvc } = await import("@/services/index.js");
    const { Services: Svc } = await import("../container.js");
    const cryptoService = await getSvc(Svc.CRYPTO_MARKET_SERVICE);

    const [prices, overview] = await Promise.all([
      cryptoService.buildFullPriceSnapshot(),
      cryptoService.buildMarketOverview(),
    ]);

    socket.emit(SocketEvent.UPDATE_CRYPTO_PRICES, { prices, overview });
  }

  private async handleUnsubscribe(
    socket: Socket,
    request: SubscriptionRequest,
    callback?: (response: SubscriptionConfirmation) => void,
  ): Promise<void> {
    try {
      const rooms = RoomManager.getRoomsForSubscription(
        request.type,
        request.serverId,
      );

      for (const room of rooms) {
        await socket.leave(room);
        this.clientSockets.get(socket.id)?.delete(room);
      }

      const primaryRoom = rooms[0];

      logger.debug(
        `Client ${socket.id} unsubscribed from ${request.type}${request.serverId ? ` (server: ${request.serverId})` : ""}`,
      );

      const confirmation: SubscriptionConfirmation = {
        type: request.type,
        serverId: request.serverId,
        room: primaryRoom,
        success: true,
      };

      if (callback) {
        callback(confirmation);
      }

      socket.emit(SocketEvent.UNSUBSCRIBED, confirmation);
    } catch (error) {
      logger.error(
        `Failed to unsubscribe client ${socket.id} from ${request.type}:`,
        error,
      );

      const confirmation: SubscriptionConfirmation = {
        type: request.type,
        serverId: request.serverId,
        room: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      if (callback) {
        callback(confirmation);
      }
    }
  }

  private async handleInitialDataRequest(
    socket: Socket,
    request: InitialDataRequest,
    callback?: (data: InitialDataPayload | ServerInitialDataPayload) => void,
  ): Promise<void> {
    try {
      const includeMessages = request.includeMessages ?? true;
      const messageLimit =
        request.messageLimit ?? this.config.maxInitialMessages ?? 50;

      let data: InitialDataPayload | ServerInitialDataPayload;

      if (request.serverId !== undefined) {
        data = await this.dataProvider.getServerInitialData(
          request.serverId,
          includeMessages,
          messageLimit,
        );

        logger.debug(
          `Sent initial data for server ${request.serverId} to client ${socket.id}`,
        );
      } else {
        data = await this.dataProvider.getInitialData(
          includeMessages,
          messageLimit,
        );

        logger.debug(`Sent initial data (all servers) to client ${socket.id}`);
      }

      if (callback) {
        callback(data);
      }

      socket.emit(SocketEvent.INITIAL_DATA, data);
    } catch (error) {
      logger.error(
        `Failed to send initial data to client ${socket.id}:`,
        error,
      );
      socket.emit(SocketEvent.ERROR, {
        message: "Failed to load initial data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private connectToServices(
    messageCacheService: MessageCacheService,
    playtimeManagerService: PlaytimeManagerService,
  ): void {
    messageCacheService.on("messageCreate", (serverId, message) => {
      this.broadcastMessageUpdate(serverId, "new", message);
    });

    messageCacheService.on("messageUpdate", (serverId, message) => {
      this.broadcastMessageUpdate(serverId, "update", message);
    });

    messageCacheService.on("messageDelete", (serverId, messageId) => {
      this.broadcastMessageUpdate(serverId, "delete", undefined, messageId);
    });

    messageCacheService.on("serverStarted", (serverId) => {
      this.broadcastServerStatusUpdate(serverId, true);
    });

    messageCacheService.on("serverClosed", (serverId) => {
      this.broadcastServerStatusUpdate(serverId, false);
    });

    for (const [
      serverId,
      playtimeService,
    ] of playtimeManagerService.getAllServices()) {
      playtimeService.on("sessionStart", (event: SessionStartEvent) => {
        this.broadcastPlayerJoin(serverId, event);
      });

      playtimeService.on("sessionEnd", (event: SessionEndEvent) => {
        this.broadcastPlayerLeave(serverId, event);
      });
    }

    logger.debug("Connected to external services");
  }

  private async broadcastServerStatusUpdate(
    serverId: number,
    online: boolean,
  ): Promise<void> {
    try {
      const status = await this.dataProvider.getServerStatus(serverId);
      status.online = online;

      const payload: ServerStatusUpdatePayload = {
        serverId,
        online,
        maintenance: status.maintenance,
        scheduledMaintenance: status.scheduledMaintenance,
        playerCount: status.playerCount,
        maxPlayers: status.maxPlayers,
        timestamp: new Date(),
      };

      this.io
        .to(RoomManager.getServerStatusRoom(serverId))
        .emit(SocketEvent.UPDATE_SERVER_STATUS, payload);

      this.io
        .to(RoomManager.getServerStatusRoom())
        .emit(SocketEvent.UPDATE_SERVER_STATUS, payload);

      logger.debug(
        `Broadcast server status update: server ${serverId} ${online ? "online" : "offline"}`,
      );
    } catch (error) {
      logger.error("Failed to broadcast server status update:", error);
    }
  }

  private broadcastPlayerJoin(
    serverId: number,
    event: SessionStartEvent,
  ): void {
    const payload: PlayersUpdatePayload = {
      serverId,
      type: "join",
      player: {
        uuid: event.uuid,
        username: event.username,
        serverId: event.serverId,
        sessionStart: event.sessionStart,
        sessionDuration: 0,
      },
      timestamp: new Date(),
    };

    this.io
      .to(RoomManager.getPlayersRoom(serverId))
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    this.io
      .to(RoomManager.getPlayersRoom())
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    logger.debug(
      `Broadcast player join: ${event.username} on server ${serverId}`,
    );

    this.broadcastServerStatusUpdate(serverId, true);
  }

  private broadcastPlayerLeave(serverId: number, event: SessionEndEvent): void {
    const payload: PlayersUpdatePayload = {
      serverId,
      type: "leave",
      player: {
        uuid: event.uuid,
        username: event.username,
        serverId: event.serverId,
        sessionStart: event.sessionStart,
        sessionDuration: event.secondsPlayed,
      },
      timestamp: new Date(),
    };

    this.io
      .to(RoomManager.getPlayersRoom(serverId))
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    this.io
      .to(RoomManager.getPlayersRoom())
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    logger.debug(
      `Broadcast player leave: ${event.username} from server ${serverId}`,
    );

    this.broadcastServerStatusUpdate(serverId, true);
  }

  private broadcastMessageUpdate(
    serverId: number,
    type: "new" | "update" | "delete",
    message?: CachedMessage,
    messageId?: string,
  ): void {
    const payload: MessageUpdatePayload = {
      serverId,
      type,
      message,
      messageId,
      timestamp: new Date(),
    };

    this.io
      .to(RoomManager.getMessagesRoom(serverId))
      .emit(SocketEvent.UPDATE_MESSAGE, payload);

    this.io
      .to(RoomManager.getMessagesRoom())
      .emit(SocketEvent.UPDATE_MESSAGE, payload);

    logger.debug(
      `Broadcast message ${type}: ${messageId || message?.messageId} on server ${serverId}`,
    );
  }

  /** Runtime snapshot: connected client count, per-room sizes, per-subscription totals, and uptime seconds. */
  async getStats(): Promise<WebSocketStats> {
    const rooms: Record<string, number> = {};
    const subscriptions: Record<SubscriptionType, number> = {
      [SubscriptionType.ALL]: 0,
      [SubscriptionType.SERVER_STATUS]: 0,
      [SubscriptionType.PLAYERS]: 0,
      [SubscriptionType.MESSAGES]: 0,
      [SubscriptionType.CRYPTO_MARKET]: 0,
    };

    const socketRooms = await this.io.sockets.adapter.rooms;
    for (const [roomName, socketIds] of socketRooms.entries()) {
      // Skip individual socket rooms (created by Socket.IO automatically)
      if (socketIds.size === 1 && socketIds.has(roomName)) {
        continue;
      }

      rooms[roomName] = socketIds.size;

      const parsed = RoomManager.parseRoom(roomName);
      if (parsed.type in subscriptions) {
        subscriptions[parsed.type as SubscriptionType] += socketIds.size;
      }
    }

    const uptimeSeconds = Math.floor(
      (Date.now() - this.startTime.getTime()) / 1000,
    );

    return {
      connectedClients: this.io.sockets.sockets.size,
      rooms,
      subscriptions,
      uptime: uptimeSeconds,
    };
  }

  /** Closes the Socket.IO server and clears tracked client, IP, and event-bucket state. */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.io.close();
    this.clientSockets.clear();
    this.connectionsByIp.clear();
    this.eventBuckets.clear();
    this.isInitialized = false;

    logger.info("WebSocketService closed");
  }

  /** Re-broadcasts the current status for a server; use after external state (e.g. maintenance) changes. */
  async triggerServerStatusUpdate(serverId: number): Promise<void> {
    const status = await this.dataProvider.getServerStatus(serverId);
    await this.broadcastServerStatusUpdate(serverId, status.online);
  }

  /** Emits the complete current player list for a server; use for recovery instead of join/leave deltas. */
  async broadcastPlayerSync(serverId: number): Promise<void> {
    const players = await this.dataProvider.getServerPlayers(serverId);

    const payload: PlayersUpdatePayload = {
      serverId,
      type: "sync",
      players,
      timestamp: new Date(),
    };

    this.io
      .to(RoomManager.getPlayersRoom(serverId))
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    this.io
      .to(RoomManager.getPlayersRoom())
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    logger.info(
      `Broadcast player sync for server ${serverId}: ${players.length} players`,
    );
  }

  /** Emits an arbitrary event and payload to every client in a named room. */
  broadcastToRoom(room: string, event: string, payload: unknown): void {
    this.io.to(room).emit(event, payload);
  }
}
