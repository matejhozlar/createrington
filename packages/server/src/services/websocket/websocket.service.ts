import type { Server as HttpServer } from "node:http";
import {
  Server as SocketIOServer,
  type DefaultEventsMap,
  type Socket as SocketIOSocket,
} from "socket.io";
import type {
  InitialDataPayload,
  InitialDataRequest,
  MessageUpdatePayload,
  PlayersUpdatePayload,
  ServerInitialDataPayload,
  ServerStatusUpdatePayload,
  SubscriptionConfirmation,
  WebSocketServiceConfig,
  WebSocketStats,
} from "./types";
import { SocketEvent, SubscriptionType } from "./types";
import type { MessageCacheService } from "../discord/message/cache";
import type { PlaytimeManagerService } from "../playtime/playtime-manager.service";
import { RoomManager } from "./room-manager";
import { isValidServerId } from "../mc-server/servers";
import { WebSocketDataProvider } from "./data-provider";
import {
  parseInitialDataRequest,
  parseSubscriptionRequest,
  rejectedSubscription,
  splitFrame,
} from "./request-validation";
import type { CachedMessage } from "../discord/message/cache";
import type { SessionEndEvent, SessionStartEvent } from "../playtime";
import { jwtService } from "@/services/auth/jwt";
import type { JWTPayload } from "@createrington/shared/auth";

type SocketData = { user?: JWTPayload };
type SocketServer = SocketIOServer<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
type Socket = SocketIOSocket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

const MAX_CONNECTIONS_PER_IP = 20;
const EVENTS_PER_SOCKET_PER_MIN = 60;

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
 * subscription-based rooms (server status, players, messages), serves
 * initial state snapshots on demand, and bridges domain events from
 * `MessageCacheService` and each `PlaytimeService` into room broadcasts. The handshake
 * applies a per-IP connection cap (with nginx X-Real-IP awareness) and accepts an
 * optional Bearer token; authenticated sockets auto-join a private per-user room
 * reserved for owner-only events, while invalid tokens degrade to anonymous rather
 * than reject. Per-socket event budgets prevent one tab from starving others on the
 * same client. Construction wires the HTTP server
 * and connection handlers; `initialize()` must be called with both dependency
 * services before event-driven broadcasting will fire.
 */
export class WebSocketService {
  private io: SocketServer;
  private dataProvider!: WebSocketDataProvider;
  private isInitialized = false;
  private startTime: Date;

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

      const token =
        typeof socket.handshake.auth?.token === "string"
          ? socket.handshake.auth.token
          : undefined;
      if (token) {
        try {
          socket.data.user = jwtService.verify(token);
        } catch {}
      }

      next();
    });
  }

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
  initialize(
    messageCacheService: MessageCacheService,
    playtimeManagerService: PlaytimeManagerService,
  ): void {
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

      const { user } = socket.data;
      if (user?.minecraftUuid) {
        void socket.join(RoomManager.getUserRoom(user.minecraftUuid));
      }

      for (const [event, action] of [
        [SocketEvent.SUBSCRIBE, "join"],
        [SocketEvent.UNSUBSCRIBE, "leave"],
      ] as const) {
        socket.on(event, (request: unknown, callback: unknown) => {
          this.changeSubscription(socket, request, callback, action).catch(
            (error) => {
              logger.error(
                `Unhandled ${event} failure for ${socket.id}:`,
                error,
              );
            },
          );
        });
      }

      socket.on(
        SocketEvent.REQUEST_INITIAL_DATA,
        (request: unknown, callback: unknown) =>
          this.onInitialDataRequest(socket, request, callback),
      );

      socket.on(SocketEvent.DISCONNECT, () => {
        logger.info(`Client disconnected: ${socket.id}`);
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

  private async changeSubscription(
    socket: Socket,
    rawRequest: unknown,
    rawCallback: unknown,
    action: "join" | "leave",
  ): Promise<void> {
    const { payload, ack } = splitFrame<SubscriptionConfirmation>(
      rawRequest,
      rawCallback,
    );
    const event = action === "join" ? "subscribe" : "unsubscribe";
    if (!this.allowSocketEvent(socket.id)) {
      logger.warn(`[ws] rate-limited ${socket.id} on ${event}`);
      ack?.(rejectedSubscription(payload, "Rate limited"));
      return;
    }
    const request = parseSubscriptionRequest(payload);
    if (!request) {
      logger.warn(`[ws] invalid ${event} payload from ${socket.id}`);
      ack?.(rejectedSubscription(payload, "Invalid subscription request"));
      return;
    }
    if (
      action === "join" &&
      request.serverId !== undefined &&
      !isValidServerId(request.serverId)
    ) {
      logger.warn(
        `[ws] subscribe to unknown server ${request.serverId} from ${socket.id}`,
      );
      ack?.(rejectedSubscription(payload, "Unknown server"));
      return;
    }

    const { type, serverId } = request;
    try {
      const rooms = RoomManager.getRoomsForSubscription(type, serverId);
      for (const room of rooms) {
        await (action === "join" ? socket.join(room) : socket.leave(room));
      }
      logger.debug(
        `Client ${socket.id} ${event}d ${type}${serverId ? ` (server: ${serverId})` : ""} - rooms: ${rooms.join(", ")}`,
      );
      ack?.({ type, serverId, room: rooms[0], success: true });
    } catch (error) {
      logger.error(
        `Failed to ${event} client ${socket.id} for ${type}:`,
        error,
      );
      ack?.({
        type,
        serverId,
        room: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private onInitialDataRequest(
    socket: Socket,
    rawRequest: unknown,
    rawCallback: unknown,
  ): void {
    const { payload, ack } = splitFrame<
      InitialDataPayload | ServerInitialDataPayload
    >(rawRequest, rawCallback);
    if (!this.allowSocketEvent(socket.id)) {
      logger.warn(`[ws] rate-limited ${socket.id} on initialDataRequest`);
      socket.emit(SocketEvent.ERROR, {
        message: "Rate limited",
        event: SocketEvent.REQUEST_INITIAL_DATA,
      });
      return;
    }
    const request = parseInitialDataRequest(payload);
    if (!request) {
      logger.warn(`[ws] invalid initial data payload from ${socket.id}`);
      socket.emit(SocketEvent.ERROR, {
        message: "Invalid initial data request",
        event: SocketEvent.REQUEST_INITIAL_DATA,
      });
      return;
    }
    this.handleInitialDataRequest(socket, request, ack);
  }

  private handleInitialDataRequest(
    socket: Socket,
    request: InitialDataRequest,
    callback?: (data: InitialDataPayload | ServerInitialDataPayload) => void,
  ): void {
    try {
      const includeMessages = request.includeMessages ?? true;
      const messageLimit =
        request.messageLimit ?? this.config.maxInitialMessages ?? 50;

      let data: InitialDataPayload | ServerInitialDataPayload;

      if (request.serverId !== undefined) {
        data = this.dataProvider.getServerInitialData(
          request.serverId,
          includeMessages,
          messageLimit,
        );

        logger.debug(
          `Sent initial data for server ${request.serverId} to client ${socket.id}`,
        );
      } else {
        data = this.dataProvider.getInitialData(includeMessages, messageLimit);

        logger.debug(`Sent initial data (all servers) to client ${socket.id}`);
      }

      if (callback) {
        callback(data);
      }
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
        this.broadcastPlayerChange(serverId, "join", event, 0);
      });

      playtimeService.on("sessionEnd", (event: SessionEndEvent) => {
        this.broadcastPlayerChange(
          serverId,
          "leave",
          event,
          event.secondsPlayed,
        );
      });
    }

    logger.debug("Connected to external services");
  }

  private emitToServerRooms(
    type: Exclude<SubscriptionType, SubscriptionType.ALL>,
    serverId: number,
    event: SocketEvent,
    payload: unknown,
  ): void {
    this.io
      .to(RoomManager.getRoomForSubscription(type, serverId))
      .emit(event, payload);
    this.io.to(RoomManager.getRoomForSubscription(type)).emit(event, payload);
  }

  private broadcastServerStatusUpdate(serverId: number, online: boolean): void {
    try {
      const status = this.dataProvider.getServerStatus(serverId);
      status.online = online;

      const payload: ServerStatusUpdatePayload = {
        serverId,
        serverSlug: status.serverSlug,
        online,
        maintenance: status.maintenance,
        scheduledMaintenance: status.scheduledMaintenance,
        playerCount: status.playerCount,
        maxPlayers: status.maxPlayers,
        timestamp: new Date().toISOString(),
      };

      this.emitToServerRooms(
        SubscriptionType.SERVER_STATUS,
        serverId,
        SocketEvent.UPDATE_SERVER_STATUS,
        payload,
      );

      logger.debug(
        `Broadcast server status update: server ${serverId} ${online ? "online" : "offline"}`,
      );
    } catch (error) {
      logger.error("Failed to broadcast server status update:", error);
    }
  }

  private broadcastPlayerChange(
    serverId: number,
    type: "join" | "leave",
    event: SessionStartEvent,
    sessionDuration: number,
  ): void {
    const payload: PlayersUpdatePayload = {
      serverId,
      type,
      player: {
        uuid: event.uuid,
        username: event.username,
        serverId: event.serverId,
        sessionStart: event.sessionStart.toISOString(),
        sessionDuration,
      },
      timestamp: new Date().toISOString(),
    };

    this.emitToServerRooms(
      SubscriptionType.PLAYERS,
      serverId,
      SocketEvent.UPDATE_PLAYERS,
      payload,
    );

    logger.debug(
      `Broadcast player ${type}: ${event.username} on server ${serverId}`,
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
      timestamp: new Date().toISOString(),
    };

    this.emitToServerRooms(
      SubscriptionType.MESSAGES,
      serverId,
      SocketEvent.UPDATE_MESSAGE,
      payload,
    );

    logger.debug(
      `Broadcast message ${type}: ${messageId || message?.messageId} on server ${serverId}`,
    );
  }

  /** Runtime snapshot: connected client count, per-room sizes, per-subscription totals, and uptime seconds. */
  getStats(): WebSocketStats {
    const rooms: Record<string, number> = {};
    const subscriptions: Record<SubscriptionType, number> = {
      [SubscriptionType.ALL]: 0,
      [SubscriptionType.SERVER_STATUS]: 0,
      [SubscriptionType.PLAYERS]: 0,
      [SubscriptionType.MESSAGES]: 0,
    };

    const socketRooms = this.io.sockets.adapter.rooms;
    for (const [roomName, socketIds] of socketRooms.entries()) {
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

  /** Closes the Socket.IO server and clears tracked IP and event-bucket state. */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.io.close();
    this.connectionsByIp.clear();
    this.eventBuckets.clear();
    this.isInitialized = false;

    logger.info("WebSocketService closed");
  }

  /** Re-broadcasts the current status for a server; use after external state (e.g. maintenance) changes. */
  triggerServerStatusUpdate(serverId: number): void {
    const status = this.dataProvider.getServerStatus(serverId);
    this.broadcastServerStatusUpdate(serverId, status.online);
  }
}
