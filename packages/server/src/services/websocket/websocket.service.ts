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

/**
 * WebSocket Service
 *
 * Manages real-time communication between the server and web clients:
 * - Subscription-based rooms for server status, players, messages, and crypto
 * - Broadcasts live updates from PlaytimeService and MessageCacheService
 * - Serves initial state snapshots on demand via REQUEST_INITIAL_DATA
 * - Tracks connected clients and room memberships for stats
 *
 * NOTE: Call initialize() with MessageCacheService and PlaytimeManagerService
 * after construction to enable event-driven broadcasting
 */
export class WebSocketService {
  private io: SocketIOServer;
  private dataProvider!: WebSocketDataProvider;
  private isInitialized = false;
  private startTime: Date;

  private clientSockets: Map<string, Set<string>> = new Map(); // socketId -> Set<rooms>

  constructor(
    httpServer: HttpServer,
    private config: WebSocketServiceConfig = {},
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: config.cors || {
        origin: "*",
        credentials: true,
      },
      path: config.path || "/socket.io",
    });

    this.startTime = new Date();
    this.setupConnectionHandlers();
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Initializes the service by wiring up data providers and service event listeners
   *
   * @param messageCacheService - Message cache service for Discord messages
   * @param playtimeManagerService - Playtime manager for player tracking
   * @returns Promise that resolves when initialization is complete
   */
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

  // ==========================================================================
  // CONNECTION HANDLERS
  // ==========================================================================

  /**
   * Registers Socket.IO connection, subscription, and error handlers on the server
   *
   * @private
   */
  private setupConnectionHandlers(): void {
    this.io.on(SocketEvent.CONNECTION, (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);

      this.clientSockets.set(socket.id, new Set());

      // Handle subscription requests
      socket.on(
        SocketEvent.SUBSCRIBE,
        (request: SubscriptionRequest, callback) => {
          this.handleSubscribe(socket, request, callback);
        },
      );

      // Handle unsubscription requests
      socket.on(
        SocketEvent.UNSUBSCRIBE,
        (request: SubscriptionRequest, callback) => {
          this.handleUnsubscribe(socket, request, callback);
        },
      );

      // Handle initial data requests
      socket.on(
        SocketEvent.REQUEST_INITIAL_DATA,
        (request: InitialDataRequest, callback) => {
          this.handleInitialDataRequest(socket, request, callback);
        },
      );

      // Handle disconnection
      socket.on(SocketEvent.DISCONNECT, () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.clientSockets.delete(socket.id);
      });

      // Handle errors
      socket.on(SocketEvent.ERROR, (error: Error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });

    logger.debug("Socket.IO connection handlers registered");
  }

  /**
   * Joins the client socket to the rooms matching the requested subscription type
   *
   * Sends a confirmation event back to the client on success or failure.
   * For CRYPTO_MARKET subscriptions, also pushes an immediate price snapshot.
   *
   * @param socket - Client socket
   * @param request - Subscription request
   * @param callback - Optional acknowledgment callback
   *
   * @private
   */
  private async handleSubscribe(
    socket: Socket,
    request: SubscriptionRequest,
    callback?: (response: SubscriptionConfirmation) => void,
  ): Promise<void> {
    try {
      // Validate server-specific subscriptions
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

      // Join all relevant rooms
      for (const room of rooms) {
        await socket.join(room);
        this.clientSockets.get(socket.id)?.add(room);
      }

      const primaryRoom = rooms[0];

      logger.debug(
        `Client ${socket.id} subscribed to ${request.type}${request.serverId ? ` (server: ${request.serverId})` : ""} - rooms: ${rooms.join(", ")}`,
      );

      // Send acknowledgment
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

      // Push an immediate price snapshot so the client doesn't wait for the next tick
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

  /**
   * Pushes the current crypto market state (all token prices + overview) to a single client
   *
   * @param socket - The client socket to send the snapshot to
   * @private
   */
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

  /**
   * Removes the client socket from the rooms matching the requested subscription type
   *
   * @param socket - Client socket
   * @param request - Unsubscription request
   * @param callback - Optional acknowledgment callback
   *
   * @private
   */
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

      // Leave all relevant rooms
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

  /**
   * Responds to a client request for current state (servers, players, messages)
   *
   * If a serverId is present in the request, returns server-scoped data;
   * otherwise returns the combined state for all servers.
   *
   * @param socket - Client socket
   * @param request - Initial data request
   * @param callback - Optional callback to deliver the payload
   *
   * @private
   */
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
        // Server-specific data
        data = await this.dataProvider.getServerInitialData(
          request.serverId,
          includeMessages,
          messageLimit,
        );

        logger.debug(
          `Sent initial data for server ${request.serverId} to client ${socket.id}`,
        );
      } else {
        // All servers data
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

  // ==========================================================================
  // SERVICE INTEGRATION
  // ==========================================================================

  /**
   * Subscribes to events from MessageCacheService and PlaytimeManagerService
   * and wires them to the corresponding broadcast methods
   *
   * @param messageCacheService - Message cache service
   * @param playtimeManagerService - Playtime manager service
   *
   * @private
   */
  private connectToServices(
    messageCacheService: MessageCacheService,
    playtimeManagerService: PlaytimeManagerService,
  ): void {
    // Message cache events
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

    // Playtime service events
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

  // ==========================================================================
  // BROADCASTING
  // ==========================================================================

  /**
   * Broadcasts a server online/offline status update to all subscribed clients
   *
   * @param serverId - Server ID
   * @param online - Whether the server is online
   *
   * @private
   */
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
        playerCount: status.playerCount,
        maxPlayers: status.maxPlayers,
        timestamp: new Date(),
      };

      // Broadcast to server-specific room
      this.io
        .to(RoomManager.getServerStatusRoom(serverId))
        .emit(SocketEvent.UPDATE_SERVER_STATUS, payload);

      // Broadcast to global room
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

  /**
   * Broadcasts a player join event and triggers a server status update
   *
   * @param serverId - Server ID
   * @param event - Session start event from PlaytimeService
   *
   * @private
   */
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

    // Broadcast to server-specific room
    this.io
      .to(RoomManager.getPlayersRoom(serverId))
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    // Broadcast to global room
    this.io
      .to(RoomManager.getPlayersRoom())
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    logger.debug(
      `Broadcast player join: ${event.username} on server ${serverId}`,
    );

    // Also update server status (player count increased)
    this.broadcastServerStatusUpdate(serverId, true);
  }

  /**
   * Broadcasts a player leave event and triggers a server status update
   *
   * @param serverId - Server ID
   * @param event - Session end event from PlaytimeService
   *
   * @private
   */
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

    // Broadcast to server-specific room
    this.io
      .to(RoomManager.getPlayersRoom(serverId))
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    // Broadcast to global room
    this.io
      .to(RoomManager.getPlayersRoom())
      .emit(SocketEvent.UPDATE_PLAYERS, payload);

    logger.debug(
      `Broadcast player leave: ${event.username} from server ${serverId}`,
    );

    // Also update server status (player count decreased)
    this.broadcastServerStatusUpdate(serverId, true);
  }

  /**
   * Broadcasts a Discord message create, update, or delete event
   *
   * @param serverId - Server ID
   * @param type - Update type: "new", "update", or "delete"
   * @param message - Full message data (for new/update events)
   * @param messageId - Message ID (for delete events)
   *
   * @private
   */
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

    // Broadcast to server-specific room
    this.io
      .to(RoomManager.getMessagesRoom(serverId))
      .emit(SocketEvent.UPDATE_MESSAGE, payload);

    // Broadcast to global room
    this.io
      .to(RoomManager.getMessagesRoom())
      .emit(SocketEvent.UPDATE_MESSAGE, payload);

    logger.debug(
      `Broadcast message ${type}: ${messageId || message?.messageId} on server ${serverId}`,
    );
  }

  // ==========================================================================
  // STATS & CLEANUP
  // ==========================================================================

  /**
   * Returns runtime statistics including connected client count, room sizes, and uptime
   *
   * @returns Current WebSocketStats snapshot
   */
  async getStats(): Promise<WebSocketStats> {
    const rooms: Record<string, number> = {};
    const subscriptions: Record<SubscriptionType, number> = {
      [SubscriptionType.ALL]: 0,
      [SubscriptionType.SERVER_STATUS]: 0,
      [SubscriptionType.PLAYERS]: 0,
      [SubscriptionType.MESSAGES]: 0,
      [SubscriptionType.CRYPTO_MARKET]: 0,
    };

    // Count clients in each room
    const socketRooms = await this.io.sockets.adapter.rooms;
    for (const [roomName, socketIds] of socketRooms.entries()) {
      // Skip individual socket rooms (these are created by Socket.IO automatically)
      if (socketIds.size === 1 && socketIds.has(roomName)) {
        continue;
      }

      rooms[roomName] = socketIds.size;

      // Count subscriptions by type
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

  /**
   * Closes the Socket.IO server and clears all tracked client state
   *
   * @returns Promise that resolves when the server has been shut down
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.io.close();
    this.clientSockets.clear();
    this.isInitialized = false;

    logger.info("WebSocketService closed");
  }

  /**
   * Emits a full player sync for a server to all subscribed clients
   *
   * Useful for recovery or debugging — sends the complete current player list
   * rather than incremental join/leave events.
   *
   * @param serverId - Server ID to sync players for
   */
  /**
   * Triggers a server status broadcast to all subscribed clients.
   * Used when external state (e.g. maintenance mode) changes.
   */
  async triggerServerStatusUpdate(serverId: number): Promise<void> {
    const status = await this.dataProvider.getServerStatus(serverId);
    await this.broadcastServerStatusUpdate(serverId, status.online);
  }

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

  /**
   * Broadcasts an arbitrary event and payload to all clients in a named room
   *
   * @param room - Room name to broadcast to
   * @param event - Socket event name
   * @param payload - Data to send
   */
  broadcastToRoom(room: string, event: string, payload: unknown): void {
    this.io.to(room).emit(event, payload);
  }
}
