import { ActivityType } from "discord.js";

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
import type { DiscordMessageService } from "./discord/message/message.service";
import { Discord } from "@/discord/constants";
import {
  MESSAGE_CACHE_CONFIG,
  MessageCacheService,
} from "./discord/message/cache";
import { TicketService } from "./discord/tickets";
import { LeaderboardService } from "./discord/leaderboard";
import { InactivityCleanupService } from "./discord/cleanup/inactivity/inactivity-cleanup.service";
import { GhostMemberService } from "./discord/cleanup/ghost/ghost-member.service";
import { UnlinkedMemberService } from "./discord/cleanup/unlinked/unlinked-member.service";
import { WaitlistCleanupService } from "./waitlist/waitlist-cleanup.service";
import { VoteProjectRefreshService } from "./vote/refresh.service";
import { MemberCleanupService } from "./discord/cleanup/member/member-cleanup.service";
import { SERVER_STATS_CONFIG, ServerStatsService } from "./discord/stats";
import { buildMainBotStatuses, RotatingStatusService } from "./discord/status";
import { PlaytimeManagerService } from "./playtime/playtime-manager.service";
import { RoleManagementService } from "./discord/role/role-management.service";
import { WebSocketService } from "./websocket";
import { PlayerBanService } from "./player/ban";
import { playerDeletionService } from "./player/deletion";
import { nomadsWhitelist } from "./whitelist/nomads";
import { StatsImportService, STATS_IMPORT_SERVERS } from "./stats-import";
import { AchievementService } from "./achievement";
import { FaqService } from "./discord/faq";
import { PuppeteerService } from "./puppeteer";
import { CryptoMarketService, CryptoSettingsService } from "./crypto";
import { AiService } from "./ai";
import { AutoMessageService } from "./discord/auto-message";
import { lotteryService } from "./lottery";
import { maintenanceService } from "./maintenance";
import { MaintenanceScheduler } from "./maintenance/scheduler";
import { PlaytimeForwarderService } from "./playtime/forwarder.service";
import { DonationService } from "./donation/donation.service";
import { structurePackService } from "./structure-pack";
import { StructurePackRotationService } from "./structure-pack/rotation";
import { PlayerPromptService } from "./player-prompt";

/**
 * Registers all application services with the shared container
 *
 * Defines the complete service dependency graph for the application.
 * Services that share no dependencies are initialised in parallel by the
 * container. Cross-service wiring that cannot be expressed as a static
 * dependency is handled via the `serviceReady` event listener at the bottom
 * of this function.
 *
 * NOTE: `StatsImportService` is skipped in development mode to avoid
 * requiring a live Minecraft server connection during local development.
 */
export function registerServices(): void {
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

  container.register(Services.PUPPETEER_SERVICE, async () => {
    const service = new PuppeteerService();
    await service.initialize();
    return service;
  });

  if (config.ai.enabled) {
    container.register(Services.AI_SERVICE, () => {
      return new AiService(
        config.ai.openai.apiKey,
        config.ai.openai.defaultModel,
      );
    });
  } else {
    logger.warn("OpenAI API key not configured, AI service disabled");
  }

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

    if (!config.envMode.isDev) {
      webBot.user?.setPresence({
        activities: [
          {
            type: ActivityType.Custom,
            name: "custom",
            state: "createrington.com",
          },
        ],
        status: "online",
      });
    }

    return webBot;
  });

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
    Services.GHOST_MEMBER_SERVICE,
    async () => new GhostMemberService(),
    { dependencies: [Services.DISCORD_MAIN_BOT, Services.DATABASE] },
  );

  container.register(
    Services.UNLINKED_MEMBER_SERVICE,
    async () => new UnlinkedMemberService(),
    { dependencies: [Services.DISCORD_MAIN_BOT, Services.DATABASE] },
  );

  // Production-only: never run on local dev or the dev deployment
  // (dev.createrington.com ships with NODE_ENV=production, so the
  // isDevDeployment hostname check is required in addition to isProd).
  if (config.envMode.isProd && !config.envMode.isDevDeployment) {
    container.register(
      Services.INACTIVITY_CLEANUP_SERVICE,
      async () => {
        const service = new InactivityCleanupService();
        await service.initialize();
        return service;
      },
      {
        dependencies: [
          Services.DISCORD_MAIN_BOT,
          Services.MESSAGE_SERVICE,
          Services.DATABASE,
        ],
      },
    );
  }

  container.register(
    Services.VOTE_PROJECT_REFRESH,
    async () => {
      const service = new VoteProjectRefreshService();
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DATABASE] },
  );

  container.register(
    Services.WAITLIST_CLEANUP_SERVICE,
    async () => {
      const service = new WaitlistCleanupService();
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DATABASE] },
  );

  container.register(
    Services.PLAYER_PROMPT_SERVICE,
    async (c) => {
      const messageService = await c.get(Services.MESSAGE_SERVICE);
      const service = new PlayerPromptService(messageService);
      await service.initialize();
      return service;
    },
    {
      dependencies: [Services.DATABASE, Services.MESSAGE_SERVICE],
    },
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
      const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
      const cryptoMarket = await c.get(Services.CRYPTO_MARKET_SERVICE);
      const service = new RotatingStatusService(
        mainBot,
        buildMainBotStatuses({ cryptoMarket }),
      );
      await service.initialize();
      return service;
    },
    {
      dependencies: [
        Services.DISCORD_MAIN_BOT,
        Services.CRYPTO_MARKET_SERVICE,
        Services.DATABASE,
      ],
    },
  );

  container.register(
    Services.AUTO_MESSAGE_SERVICE,
    async (c) => {
      const messageService = await c.get(Services.WEB_MESSAGE_SERVICE);
      const service = new AutoMessageService(messageService);
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DATABASE, Services.WEB_MESSAGE_SERVICE] },
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

  container.register(
    Services.PLAYER_DELETION_SERVICE,
    async () => {
      await playerDeletionService.initialize();
      playerDeletionService.onDeleted((player) =>
        nomadsWhitelist.remove(player.minecraftUsername),
      );
      return playerDeletionService;
    },
    { dependencies: [Services.DATABASE] },
  );

  container.register(
    Services.PLAYTIME_MANAGER_SERVICE,
    async () => {
      const service = new PlaytimeManagerService();
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DISCORD_WEB_BOT, Services.MESSAGE_CACHE] },
  );

  if (!config.envMode.isDev) {
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
  } else {
    logger.info("Skipping StatsImportService in development mode");
  }

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

  container.register(
    Services.CRYPTO_SETTINGS_SERVICE,
    async () => {
      const service = new CryptoSettingsService();
      await service.initialize();
      return service;
    },
    { dependencies: [Services.DATABASE] },
  );

  container.register(
    Services.CRYPTO_MARKET_SERVICE,
    async (c) => {
      const settings = await c.get(Services.CRYPTO_SETTINGS_SERVICE);
      const service = new CryptoMarketService(settings);
      await service.initialize();
      return service;
    },
    {
      dependencies: [
        Services.DATABASE,
        Services.WEBSOCKET_SERVICE,
        Services.CRYPTO_SETTINGS_SERVICE,
      ],
    },
  );

  if (config.stripe.enabled) {
    container.register(
      Services.DONATION_SERVICE,
      async (c) => {
        const mainBot = await c.get(Services.DISCORD_MAIN_BOT);
        return new DonationService(mainBot);
      },
      { dependencies: [Services.DISCORD_MAIN_BOT] },
    );
  } else {
    logger.warn("Stripe keys not configured, donation service disabled");
  }

  container.register(
    Services.WEBSOCKET_SERVICE,
    async (c) => {
      const httpServer = await c.get(Services.HTTP_SERVER);
      const messageCacheService = await c.get(Services.MESSAGE_CACHE);
      const playtimeManagerService = await c.get(
        Services.PLAYTIME_MANAGER_SERVICE,
      );

      logger.info("Initializing WebSocket service...");

      const websocketService = new WebSocketService(httpServer, {
        cors: {
          origin: config.envMode.isDev
            ? config.app.devClientOrigin
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
    if (serviceName === Services.DATABASE) {
      lotteryService
        .initialize()
        .catch((err) =>
          logger.error("LotteryService initialization failed:", err),
        );
    }

    // Wire message cache into playtime manager for server shutdown detection
    if (serviceName === Services.MESSAGE_CACHE) {
      const playtimeManager = await container.get(
        Services.PLAYTIME_MANAGER_SERVICE,
      );
      const messageCache = await container.get(Services.MESSAGE_CACHE);

      playtimeManager.setupMessageCacheIntegration(messageCache);
    }

    // Hook achievement evaluation into stats import completion
    if (
      serviceName === Services.STATS_IMPORT_SERVICE &&
      !config.envMode.isDev
    ) {
      const statsImport = await container.get(Services.STATS_IMPORT_SERVICE);
      const achievement = await container.get(Services.ACHIEVEMENT_SERVICE);

      statsImport.onImportComplete((serverId, uuids) => {
        achievement
          .evaluateServer(serverId, uuids)
          .catch((err) => logger.error("Achievement evaluation failed:", err));
      });
    }

    // Wire real-time role checks to playtime events on each server
    if (serviceName === Services.PLAYTIME_MANAGER_SERVICE) {
      const playtimeManager = await container.get(
        Services.PLAYTIME_MANAGER_SERVICE,
      );
      const roleService = await container.get(Services.ROLE_MANAGEMENT_SERVICE);

      for (const [
        serverId,
        playtimeService,
      ] of playtimeManager.getAllServices()) {
        roleService.setupRealtimeRoleChecking(serverId, playtimeService);
      }

      // Wire playtime forwarder on the dev site so test-server sessions
      // are also recorded in the production database
      if (config.sync.targetUrl && config.sync.secret) {
        const forwarder = new PlaytimeForwarderService(
          config.sync.targetUrl,
          config.sync.secret,
        );

        for (const [
          serverId,
          playtimeService,
        ] of playtimeManager.getAllServices()) {
          forwarder.connectToService(playtimeService, serverId);
        }

        logger.info(`Playtime forwarder active → ${config.sync.targetUrl}`);
      }
    }
  });

  logger.info(`Registered ${container.size} services`);
}

/**
 * Registers and initialises all application services
 *
 * Calls `registerServices()` to populate the container, then triggers
 * parallel initialisation of all non-lazy services. Logs a summary of
 * ready vs total services on completion.
 *
 * @returns Promise that resolves once all services have settled
 */
export async function initializeServices(): Promise<void> {
  logger.info("Starting service initialization...");

  registerServices();

  await container.initializeAll();

  const states = container.getAllStates();
  const ready = Object.values(states).filter((s) => s === "ready").length;
  const total = Object.keys(states).length;

  logger.info(`✓ Service initialization complete: ${ready}/${total} ready`);

  // Initialize maintenance service (checks for backup files via local path or SFTP)
  maintenanceService
    .initialize([config.servers.cogs.id])
    .catch((err) => logger.warn(`Maintenance service init failed: ${err}`));

  // Initialize maintenance scheduler (loads pending schedules, sets up timers)
  try {
    const webMessageService = await container.get(Services.WEB_MESSAGE_SERVICE);
    const scheduler = new MaintenanceScheduler(
      maintenanceService,
      webMessageService,
    );
    await scheduler.initialize();
    maintenanceService.setScheduler(scheduler);
    logger.info("Maintenance scheduler initialized");
  } catch (error) {
    logger.warn(`Maintenance scheduler init failed: ${error}`);
  }

  try {
    let webMessageService: DiscordMessageService | null = null;
    try {
      webMessageService = await container.get(Services.WEB_MESSAGE_SERVICE);
    } catch {
      // OK: Discord may not be configured
    }
    const rotationService = new StructurePackRotationService(
      structurePackService,
      webMessageService,
    );
    // Register before init so tRPC routes work even if scheduling fails
    container.register(Services.STRUCTURE_PACK_ROTATION, () => rotationService);
    await rotationService.initialize();
    logger.info("Structure pack rotation service initialized");
  } catch (error) {
    logger.warn(`Structure pack rotation service init failed: ${error}`);
  }
}

/**
 * Gracefully shuts down all registered services in reverse order
 *
 * Delegates to `container.shutdown()`, which calls each service's `shutdown()`
 * method where available and clears the registry.
 *
 * @returns Promise that resolves once all shutdown hooks have settled
 */
export async function shutdownServices(): Promise<void> {
  await container.shutdown();
}
