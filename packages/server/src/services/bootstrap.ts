import { container, Services } from "./container";
import { createApp } from "@/app";
import http from "node:http";
import pool from "@/db";
import { mainBot } from "@/discord/bots/main/client";
import config from "@/config";
import { setupMainBotHandlers } from "@/discord/bots/main/setup";
import { webBot } from "@/discord/bots/web/client";
import { setupWebBotHandlers } from "@/discord/bots/web/setup";
import { createDiscordMessageService } from "./discord/message";
import { Discord } from "@/discord/constants";
import { MESSAGE_CACHE_CONFIG, MessageCacheService } from "./discord/message/cache";
import { TicketService } from "./discord/tickets";
import { LeaderboardService } from "./discord/leaderboard";
import { MemberCleanupService } from "./discord/cleanup/member/member-cleanup.service";
import { SERVER_STATS_CONFIG, ServerStatsService } from "./discord/stats";
import { RotatingStatusService } from "./discord/status";
import { PlaytimeManagerService } from "./playtime/playtime-manager.service";
import { RoleManagementService } from "./discord/role/role-management.service";
import { WebSocketService } from "./websocket";
import { PlayerBanService } from "./player/ban";
import { StatsImportService, STATS_IMPORT_SERVERS } from "./stats-import";
import { AchievementService } from "./achievement";
import { FaqService } from "./discord/faq";

/**
 * Register all services with the container
 *
 * This function defines the entire service dependency graph.
 * Services are initialized in parallel where possible based on dependencies.
 */
export function registerServices(): void {
  // =========================================================================
  // CORE INFRASTRUCTURE (no dependencies)
  // =========================================================================

  container.register(Services.DATABASE, async () => {
    // Database pool is already initialized, just verify connection
    logger.debug("Verifying database connection...");
    await pool.query("SELECT 1");
    return pool;
  });

  container.register(Services.HTTP_SERVER, async () => {
    logger.debug("Creating HTTP server...");
    const app = createApp();
    return http.createServer(app);
  });

  // =========================================================================
  // DISCORD BOTS (no dependencies, can initialize in parallel)
  // =========================================================================

  container.register(Services.DISCORD_MAIN_BOT, async () => {
    logger.info("Logging in main Discord bot...");

    await mainBot.login(config.discord.bots.main.token);
    await new Promise<void>((resolve) => {
      mainBot.once("clientReady", () => {
        logger.info(`Main bot logged in: ${mainBot.user?.tag}`);
        resolve();
      });
    });

    await setupMainBotHandlers(mainBot);

    return mainBot;
  });

  container.register(Services.DISCORD_WEB_BOT, async () => {
    logger.info("Logging in web Discord bot...");

    await webBot.login(config.discord.bots.web.token);
    await new Promise<void>((resolve) => {
      webBot.once("clientReady", () => {
        logger.info(`Web bot logged in: ${webBot.user?.tag}`);
        resolve();
      });
    });

    await setupWebBotHandlers(webBot);

    return webBot;
  });

  // =========================================================================
  // DISCORD SERVICES (depend on bots)
  // =========================================================================

  container.register(
    Services.MESSAGE_SERVICE,
    async (c) => {
      const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
      const service = createDiscordMessageService(mainBot);

      Discord._setMessageService(service);

      return service;
    },
    { dependencies: [Services.DISCORD_MAIN_BOT] },
  );

  container.register(
    Services.WEB_MESSAGE_SERVICE,
    async (c) => {
      const webBot = await c.get(Services.DISCORD_WEB_BOT);
      const service = createDiscordMessageService(webBot);
      return service;
    },
    { dependencies: [Services.DISCORD_WEB_BOT] },
  );

  container.register(
    Services.MESSAGE_CACHE,
    async (c) => {
      const webBot = await c.get(Services.DISCORD_WEB_BOT);
      const service = new MessageCacheService(webBot, MESSAGE_CACHE_CONFIG);
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DISCORD_WEB_BOT] },
  );

  container.register(
    Services.LEADERBOARD_SERVICE,
    async (c) => {
      const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
      const service = new LeaderboardService(mainBot);
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DISCORD_MAIN_BOT, Services.DATABASE] },
  );

  container.register(
    Services.FAQ_SERVICE,
    async (c) => {
      const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
      const service = new FaqService(mainBot);
      await service.initialize();
      return service;
    },
    {
      dependencies: [
        Services.DISCORD_MAIN_BOT,
        Services.DATABASE,
        Services.MESSAGE_SERVICE,
      ],
    },
  );

  container.register(
    Services.TICKET_SERVICE,
    async (c) => {
      const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
      return new TicketService(mainBot);
    },
    { dependencies: [Services.DISCORD_MAIN_BOT, Services.DATABASE] },
  );

  container.register(
    Services.MEMBER_CLEANUP_SERVICE,
    async () => {
      const service = new MemberCleanupService();
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DISCORD_MAIN_BOT] },
  );

  container.register(
    Services.SERVER_STATS_SERVICE,
    async (c) => {
      const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
      const service = new ServerStatsService(mainBot, SERVER_STATS_CONFIG);
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DISCORD_MAIN_BOT] },
  );

  container.register(
    Services.ROTATING_STATUS_SERVICE,
    async (c) => {
      const webBot = await c.get(Services.DISCORD_WEB_BOT);
      const service = new RotatingStatusService(webBot);
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DISCORD_WEB_BOT] },
  );

  container.register(
    Services.PLAYER_BAN_SERVICE,
    async (c) => {
      const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
      const service = new PlayerBanService(mainBot);
      await service.initialize();
      return service;
    },
    {
      dependencies: [
        Services.DISCORD_MAIN_BOT,
        Services.DATABASE,
        Services.MESSAGE_SERVICE,
      ],
    },
  );

  // =========================================================================
  // GAME SERVICES
  // =========================================================================

  container.register(
    Services.PLAYTIME_MANAGER_SERVICE,
    async () => {
      const service = new PlaytimeManagerService();
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DISCORD_WEB_BOT, Services.MESSAGE_CACHE] },
  );

  container.register(
    Services.STATS_IMPORT_SERVICE,
    async (c) => {
      const playtimeManager = await c.get(Services.PLAYTIME_MANAGER_SERVICE);
      const service = new StatsImportService(
        playtimeManager,
        STATS_IMPORT_SERVERS,
      );
      await service.initialize();
      return service;
    },
    {
      dependencies: [Services.DATABASE, Services.PLAYTIME_MANAGER_SERVICE],
    },
  );

  container.register(
    Services.ACHIEVEMENT_SERVICE,
    async () => {
      const service = new AchievementService();
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DATABASE] },
  );

  container.register(
    Services.ROLE_MANAGEMENT_SERVICE,
    async (c) => {
      const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
      const service = new RoleManagementService(mainBot, 0);
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DISCORD_MAIN_BOT] },
  );

  // =========================================================================
  // COMMUNICATION SERVICES
  // =========================================================================

  container.register(
    Services.WEBSOCKET_SERVICE,
    async (c) => {
      const httpServer = await c.get(Services.HTTP_SERVER);
      const messageCacheService = await c.get(
        Services.MESSAGE_CACHE,
      );
      const playtimeManagerService = await c.get(
        Services.PLAYTIME_MANAGER_SERVICE,
      );

      logger.info("Initializing WebSocket service...");

      const websocketService = new WebSocketService(httpServer, {
        cors: {
          origin: config.envMode.isDev
            ? "http://localhost:5173"
            : config.meta.links.website,
          credentials: true,
        },
        path: "/socket.io",
        maxInitialMessages: 100,
      });

      await websocketService.initialize(
        messageCacheService,
        playtimeManagerService,
      );

      return websocketService;
    },
    {
      dependencies: [
        Services.HTTP_SERVER,
        Services.MESSAGE_CACHE,
        Services.PLAYTIME_MANAGER_SERVICE,
      ],
    },
  );

  container.on("serviceReady", async (serviceName) => {
    if (serviceName === Services.MESSAGE_CACHE) {
      const playtimeManager = await container.get(
        Services.PLAYTIME_MANAGER_SERVICE,
      );
      const messageCache = await container.get(
        Services.MESSAGE_CACHE,
      );

      playtimeManager.setupMessageCacheIntegration(messageCache);
    }

    if (serviceName === Services.STATS_IMPORT_SERVICE) {
      const statsImport = await container.get(Services.STATS_IMPORT_SERVICE);
      const achievement = await container.get(Services.ACHIEVEMENT_SERVICE);

      statsImport.onImportComplete((serverId, uuids) => {
        achievement.evaluateServer(serverId, uuids).catch((err) =>
          logger.error("Achievement evaluation failed:", err),
        );
      });
    }

    if (serviceName === Services.PLAYTIME_MANAGER_SERVICE) {
      const playtimeManager = await container.get(
        Services.PLAYTIME_MANAGER_SERVICE,
      );
      const roleService = await container.get(
        Services.ROLE_MANAGEMENT_SERVICE,
      );

      for (const [
        serverId,
        playtimeService,
      ] of playtimeManager.getAllServices()) {
        roleService.setupRealtimeRoleChecking(serverId, playtimeService);
      }
    }
  });

  logger.info(`Registered ${container.size} services`);
}

/**
 * Initialize all core services
 */
export async function initializeServices(): Promise<void> {
  logger.info("Starting service initialization...");

  registerServices();

  // Initialize all non-lazy services in parallel
  await container.initializeAll();

  const states = container.getAllStates();
  const ready = Object.values(states).filter((s) => s === "ready").length;
  const total = Object.keys(states).length;

  logger.info(`✓ Service initialization complete: ${ready}/${total} ready`);
}

/**
 * Graceful shutdown
 */
export async function shutdownServices(): Promise<void> {
  await container.shutdown();
}
