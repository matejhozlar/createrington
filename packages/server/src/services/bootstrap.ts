import { container, Services, ServiceState } from "./container";
import { createApp } from "@/app";
import http from "node:http";
import pool from "@/db";
import { mainBot } from "@/discord/bots/main/client";
import config from "@/config";
import { setupMainBotHandlers } from "@/discord/bots/main/setup";
import { DiscordMessageService } from "./discord/message";
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
import { waitlistPromotionService } from "./waitlist/promotion.service";
import { waitlistService } from "./waitlist/waitlist.service";
import { WorkshopProjectRefreshService } from "./workshop/refresh.service";
import { MemberCleanupService } from "./discord/cleanup/member/member-cleanup.service";
import { SERVER_STATS_CONFIG, ServerStatsService } from "./discord/stats";
import { buildMainBotStatuses, RotatingStatusService } from "./discord/status";
import { AppEmojiService } from "./discord/emojis";
import { PlaytimeManagerService } from "./playtime/playtime-manager.service";
import { RoleManagementService } from "./discord/role/role-management.service";
import { WebSocketService } from "./websocket";
import { PlayerBanService } from "./player/ban";
import { playerDeletionService } from "./player/deletion";
import { isPartyPurgeAllowed, partyPurgeService } from "./party";
import { StatsImportService } from "./stats-import";
import { SERVERS, SERVER_IDS } from "./mc-server/servers";
import { FaqService } from "./discord/faq";
import { DiscordStickyMessageService } from "./discord/sticky-message";
import { GalleryService } from "./gallery/gallery.service";
import { PuppeteerService } from "./puppeteer/puppeteer.service";
import { AiService } from "./ai/ai.service";
import { AutoMessageService } from "./discord/auto-message";
import { maintenanceService } from "./maintenance";
import { MaintenanceScheduler } from "./maintenance/scheduler";
import { releaseAnnouncementService } from "./release-announcement/release-announcement.service";
import { launcherPackAdminService } from "./launcher/pack/pack-admin.service";
import { LauncherPackFileRefreshService } from "./launcher/pack/file-refresh.service";
import { DonationService } from "./donation/donation.service";
import { structurePackService } from "./structure-pack/structure-pack.service";
import { StructurePackRotationService } from "./structure-pack/rotation/rotation.service";
import { PlayerPromptService } from "./player-prompt";
import { redisService } from "./redis";
import { VoteIntake, VoteRewardService, VotifierService } from "./votifier";

/**
 * Registers all application services with the shared container
 *
 * Defines the complete service dependency graph for the application. Each
 * factory receives the services it lists, so the container initialises
 * services that share no dependencies in parallel and every edge of the
 * graph is one a factory actually relies on.
 *
 * NOTE: `StatsImportService` is skipped in development mode to avoid
 * requiring a live Minecraft server connection during local development.
 */
export function registerServices(): void {
  container.register(Services.DATABASE, [], async () => {
    logger.debug("Verifying database connection...");
    await pool.query("SELECT 1");
    return pool;
  });

  container.register(Services.HTTP_SERVER, [], () => {
    logger.debug("Creating HTTP server...");
    const app = createApp();
    return http.createServer(app);
  });

  if (redisService.enabled) {
    container.register(Services.REDIS, [], () => {
      redisService.initialize();
      return redisService;
    });
  } else {
    logger.info(
      "Redis not configured, caches and rate limits stay in process memory",
    );
  }

  container.register(
    Services.PUPPETEER_SERVICE,
    [],
    () => new PuppeteerService(),
  );

  if (config.ai.enabled) {
    container.register(Services.AI_SERVICE, [], () => {
      return new AiService(
        config.ai.openai.apiKey,
        config.ai.openai.defaultModel,
      );
    });
  } else {
    logger.warn("OpenAI API key not configured, AI service disabled");
  }

  container.register(Services.DISCORD_MAIN_BOT, [], async () => {
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

  container.register(
    Services.MESSAGE_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    (mainBot) => {
      const service = new DiscordMessageService(mainBot);

      Discord._setMessageService(service);

      return service;
    },
  );

  container.register(
    Services.MESSAGE_CACHE,
    [Services.DISCORD_MAIN_BOT],
    async (mainBot) => {
      const service = new MessageCacheService(mainBot, MESSAGE_CACHE_CONFIG);
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.LEADERBOARD_SERVICE,
    [Services.DISCORD_MAIN_BOT, Services.APP_EMOJI_SERVICE],
    async (mainBot) => {
      const service = new LeaderboardService(mainBot);
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.STICKY_MESSAGE_SERVICE,
    [Services.DISCORD_MAIN_BOT, Services.MESSAGE_SERVICE],
    (mainBot) => new DiscordStickyMessageService(mainBot),
  );

  container.register(
    Services.FAQ_SERVICE,
    [Services.STICKY_MESSAGE_SERVICE],
    async (sticky) => {
      const service = new FaqService(sticky);
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.GALLERY_SERVICE,
    [Services.STICKY_MESSAGE_SERVICE],
    async (sticky) => {
      const service = new GalleryService(sticky, {
        intakeChannelId: config.gallery.intakeChannelId,
        originalsDir: config.gallery.originalsDir,
        serverId: config.servers.rails.id,
      });
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.TICKET_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    (mainBot) => new TicketService(mainBot),
  );

  container.register(
    Services.MEMBER_CLEANUP_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    () => {
      const service = new MemberCleanupService();
      service.initialize();
      return service;
    },
  );

  container.register(
    Services.GHOST_MEMBER_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    () => new GhostMemberService(),
  );

  container.register(
    Services.UNLINKED_MEMBER_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    () => new UnlinkedMemberService(),
  );

  if (config.envMode.isProductionDeployment) {
    container.register(
      Services.INACTIVITY_CLEANUP_SERVICE,
      [Services.DISCORD_MAIN_BOT, Services.MESSAGE_SERVICE],
      () => {
        const service = new InactivityCleanupService();
        service.initialize();
        return service;
      },
    );
  }

  if (config.launcher.available) {
    container.register(Services.LAUNCHER_PACK_FILE_REFRESH, [], () => {
      const service = new LauncherPackFileRefreshService();
      service.initialize();
      return service;
    });
  }

  container.register(
    Services.WORKSHOP_PROJECT_REFRESH,
    [Services.DISCORD_MAIN_BOT],
    () => {
      const service = new WorkshopProjectRefreshService();
      service.initialize();
      return service;
    },
  );

  if (!config.envMode.isDev) {
    container.register(
      Services.WAITLIST_CLEANUP_SERVICE,
      [Services.DISCORD_MAIN_BOT],
      () => {
        const service = new WaitlistCleanupService();
        service.initialize();
        return service;
      },
    );
  }

  container.register(
    Services.PLAYER_PROMPT_SERVICE,
    [Services.MESSAGE_SERVICE],
    async (messageService) => {
      const service = new PlayerPromptService(messageService);
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.SERVER_STATS_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    async (mainBot) => {
      const service = new ServerStatsService(mainBot, SERVER_STATS_CONFIG);
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.ROTATING_STATUS_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    async (mainBot) => {
      const service = new RotatingStatusService(
        mainBot,
        buildMainBotStatuses(),
      );
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.APP_EMOJI_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    async (mainBot) => {
      const service = new AppEmojiService(mainBot);
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.AUTO_MESSAGE_SERVICE,
    [Services.MESSAGE_SERVICE],
    async (messageService) => {
      const service = new AutoMessageService(messageService);
      await service.initialize();
      return service;
    },
  );

  container.register(
    Services.PLAYER_BAN_SERVICE,
    [Services.DISCORD_MAIN_BOT, Services.MESSAGE_SERVICE],
    async () => {
      const service = new PlayerBanService();
      await service.initialize();
      return service;
    },
  );

  container.register(Services.PLAYER_DELETION_SERVICE, [], () => {
    playerDeletionService.initialize();
    playerDeletionService.onDeleted(async (player) => {
      try {
        await waitlistService.expireForPlayerDeletion(player.discordId);
      } catch (error) {
        logger.error(
          `Failed to expire the waitlist entry of deleted player ${player.discordId}:`,
          error,
        );
      }
      await waitlistPromotionService.promoteEligible();
    });
    if (isPartyPurgeAllowed()) {
      playerDeletionService.onDeleted((player, actor) =>
        partyPurgeService.removePlayer(player, actor),
      );
    }
    return playerDeletionService;
  });

  if (isPartyPurgeAllowed()) {
    container.register(
      Services.PARTY_PURGE_SERVICE,
      [Services.HTTP_SERVER],
      () => {
        partyPurgeService.initialize();
        return partyPurgeService;
      },
    );
  }

  container.register(
    Services.ROLE_MANAGEMENT_SERVICE,
    [Services.DISCORD_MAIN_BOT],
    (mainBot) => {
      const service = new RoleManagementService(mainBot, 0);
      service.initialize();
      return service;
    },
  );

  container.register(
    Services.PLAYTIME_MANAGER_SERVICE,
    [Services.MESSAGE_CACHE, Services.ROLE_MANAGEMENT_SERVICE],
    async (messageCache, roleService) => {
      const service = new PlaytimeManagerService();
      await service.initialize();

      service.setupMessageCacheIntegration(messageCache);
      for (const [serverId, playtimeService] of service.getAllServices()) {
        roleService.setupRealtimeRoleChecking(serverId, playtimeService);
      }

      return service;
    },
  );

  if (!config.envMode.isDev) {
    container.register(
      Services.STATS_IMPORT_SERVICE,
      [Services.PLAYTIME_MANAGER_SERVICE],
      (playtimeManager) => {
        const service = new StatsImportService(playtimeManager, SERVERS);
        service.initialize();
        return service;
      },
    );
  } else {
    logger.info("Skipping StatsImportService in development mode");
  }

  if (config.stripe.enabled) {
    container.register(
      Services.DONATION_SERVICE,
      [Services.DISCORD_MAIN_BOT],
      (mainBot) => new DonationService(mainBot),
    );
  } else {
    logger.warn("Stripe keys not configured, donation service disabled");
  }

  container.register(
    Services.WEBSOCKET_SERVICE,
    [
      Services.HTTP_SERVER,
      Services.MESSAGE_CACHE,
      Services.PLAYTIME_MANAGER_SERVICE,
    ],
    (httpServer, messageCacheService, playtimeManagerService) => {
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

      websocketService.initialize(messageCacheService, playtimeManagerService);

      return websocketService;
    },
  );

  container.register(Services.STRUCTURE_PACK_ROTATION, [], async () => {
    const service = new StructurePackRotationService(structurePackService);

    try {
      await service.initialize();
      logger.info("Structure pack rotation service initialized");
    } catch (error) {
      logger.warn(`Structure pack rotation scheduling failed: ${error}`);
    }

    return service;
  });

  container.register(
    Services.MAINTENANCE_SERVICE,
    [Services.MESSAGE_SERVICE, Services.PLAYTIME_MANAGER_SERVICE],
    async (messageService, playtimeManager) => {
      try {
        const scheduler = new MaintenanceScheduler(
          maintenanceService,
          messageService,
        );
        maintenanceService.setScheduler(scheduler);
        await scheduler.initialize();
        logger.info("Maintenance scheduler initialized");
      } catch (error) {
        logger.warn(`Maintenance scheduler init failed: ${error}`);
      }

      maintenanceService
        .initialize(SERVER_IDS, playtimeManager)
        .catch((error) =>
          logger.warn(`Maintenance service init failed: ${error}`),
        );

      return maintenanceService;
    },
  );

  if (config.votifier) {
    const votifierConfig = config.votifier;
    container.register(Services.VOTIFIER_SERVICE, [], async () => {
      const intake = new VoteIntake(
        () => container.getIfReady(Services.MESSAGE_SERVICE),
        Discord.Channels.railsNSails.MINECRAFT_CHAT,
        () => container.getIfReady(Services.VOTE_REWARD_SERVICE),
      );
      const service = new VotifierService(votifierConfig, (vote) =>
        intake.accept(vote),
      );
      await service.initialize();
      return service;
    });

    container.register(
      Services.VOTE_REWARD_SERVICE,
      [Services.PLAYTIME_MANAGER_SERVICE],
      (playtimeManager) => {
        const service = new VoteRewardService(playtimeManager, undefined, {
          rewardServerIds: SERVER_IDS,
        });
        service.initialize();
        return service;
      },
    );
  } else {
    logger.info(
      "Votifier not configured, server-list votes are not received or rewarded by the app",
    );
  }

  logger.info(`Registered ${container.size} services`);
}

/**
 * Registers and initialises all application services
 *
 * Calls `registerServices()` to populate the container, then triggers
 * parallel initialisation of all services. Logs a summary of
 * ready vs total services on completion.
 */
export async function initializeServices(): Promise<void> {
  logger.info("Starting service initialization...");

  registerServices();

  await container.initializeAll();

  const states = container.getAllStates();
  const ready = Object.values(states).filter(
    (s) => s === ServiceState.READY,
  ).length;
  const total = Object.keys(states).length;

  logger.info(`✓ Service initialization complete: ${ready}/${total} ready`);

  void releaseAnnouncementService.announceIfNew();
  if (config.launcher.available) {
    launcherPackAdminService
      .seedDefaultPack()
      .catch((error) => logger.warn("Launcher pack seed failed:", error));
  }
}

/**
 * Gracefully shuts down all registered services in reverse order
 *
 * Delegates to `container.shutdown()`, which calls each service's `shutdown()`
 * method where available and clears the registry.
 */
export async function shutdownServices(): Promise<void> {
  await container.shutdown();
}
