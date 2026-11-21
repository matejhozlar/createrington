import { typedEmitter } from "@/utils/typed-emitter";
import type { Server } from "node:http";
import type { Pool } from "pg";
import type { Client } from "discord.js";
import type { DiscordMessageService } from "./discord/message/message.service";
import type { MessageCacheService } from "./discord/message/cache";
import type { TicketService } from "./discord/tickets";
import type { LeaderboardService } from "./discord/leaderboard";
import type { InactivityCleanupService } from "./discord/cleanup/inactivity/inactivity-cleanup.service";
import type { MemberCleanupService } from "./discord/cleanup/member/member-cleanup.service";
import type { GhostMemberService } from "./discord/cleanup/ghost/ghost-member.service";
import type { UnlinkedMemberService } from "./discord/cleanup/unlinked/unlinked-member.service";
import type { ServerStatsService } from "./discord/stats";
import type { RotatingStatusService } from "./discord/status";
import type { PlaytimeManagerService } from "./playtime/playtime-manager.service";
import type { RoleManagementService } from "./discord/role/role-management.service";
import type { WebSocketService } from "./websocket";
import type { PlayerBanService } from "./player/ban";
import type { PlayerDeletionService } from "./player/deletion";
import type { PartyPurgeService } from "./party";
import type { StatsImportService } from "./stats-import";
import type { FaqService } from "./discord/faq";
import type { PuppeteerService } from "./puppeteer/puppeteer.service";
import type { AiService } from "./ai/ai.service";
import type { AutoMessageService } from "./discord/auto-message";
import type { DonationService } from "./donation/donation.service";
import type { StructurePackRotationService } from "./structure-pack/rotation/rotation.service";
import type { WaitlistCleanupService } from "./waitlist/waitlist-cleanup.service";
import type { PlayerPromptService } from "./player-prompt";
import type { WorkshopProjectRefreshService } from "./workshop/refresh.service";
import type { LauncherPackFileRefreshService } from "./launcher/pack/file-refresh.service";
import type { DiscordStickyMessageService } from "./discord/sticky-message";
import type { GalleryService } from "./gallery/gallery.service";
import type { AppEmojiService } from "./discord/emojis";
import type { RedisService } from "./redis";
import type { MaintenanceService } from "./maintenance/maintenance.service";
import type { VotifierService } from "./votifier/votifier.service";
import type { VoteRewardService } from "./votifier/vote-reward.service";

export enum ServiceState {
  UNINITIALIZED = "uninitialized",
  INITIALIZING = "initializing",
  READY = "ready",
  FAILED = "failed",
}

interface ServiceDefinition<T = unknown> {
  name: string;
  factory: (container: ServiceContainer) => T | Promise<T>;
  dependencies?: string[];
  lazy?: boolean;
  state: ServiceState;
  instance?: T;
  error?: Error;
}

interface ContainerEvents {
  serviceReady: (serviceName: string) => void;
  serviceFailed: (serviceName: string, error: Error) => void;
  allReady: () => void;
}

/**
 * Centralized service container with dependency injection
 *
 * - Manages the full lifecycle of all application services (register, init, shutdown)
 * - Resolves dependencies in parallel where possible
 * - Detects circular dependencies at init time
 * - Supports lazy services that initialize only on first access
 * - Emits events for service readiness and cross-service wiring
 *
 * NOTE: The singleton `container` instance exported from this module is the
 * authoritative registry: all services must be registered through it before
 * `initializeAll()` is called during server startup
 */
export class ServiceContainer extends typedEmitter<ContainerEvents>() {
  private services: Map<string, ServiceDefinition> = new Map();
  private initializationPromises: Map<string, Promise<unknown>> = new Map();

  /**
   * Registers a service with its factory function and optional dependencies
   *
   * The factory receives the container so it can resolve its own dependencies
   * at init time. Duplicate registrations throw immediately to catch wiring
   * mistakes early.
   */
  register<T>(
    name: string,
    factory: (container: ServiceContainer) => T | Promise<T>,
    options: {
      dependencies?: string[];
      lazy?: boolean;
    } = {},
  ): void {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }

    this.services.set(name, {
      name,
      factory,
      dependencies: options.dependencies || [],
      lazy: options.lazy || false,
      state: ServiceState.UNINITIALIZED,
    });

    logger.debug(`Registered service: ${name}`);
  }

  /**
   * Returns a fully-initialised service instance, initialising it on first access
   *
   * If the service is already ready its cached instance is returned immediately.
   * If it is currently initialising the existing promise is awaited to avoid
   * duplicate factory invocations. A previously-failed service re-throws its
   * original error.
   */
  async get<K extends ServiceKey>(name: K): Promise<ServiceTypeMap[K]>;
  async get<T>(name: string): Promise<T>;
  async get(name: string): Promise<unknown> {
    const service = this.services.get(name);

    if (!service) {
      throw new Error(`Service ${name} is not registered`);
    }

    if (service.state === ServiceState.READY && service.instance) {
      return service.instance;
    }

    if (service.state === ServiceState.INITIALIZING) {
      const promise = this.initializationPromises.get(name);
      if (promise) {
        return promise;
      }
    }

    if (service.state === ServiceState.FAILED && service.error) {
      throw service.error;
    }

    return this.initializeService(name);
  }

  private async initializeService<T>(name: string): Promise<T> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }

    this.checkCircularDependency(name, new Set());

    service.state = ServiceState.INITIALIZING;

    const initPromise = (async () => {
      try {
        if (service.dependencies && service.dependencies.length > 0) {
          logger.debug(
            `Initializing dependencies for ${name}: ${service.dependencies.join(", ")}`,
          );
          await Promise.all(service.dependencies.map((dep) => this.get(dep)));
        }

        logger.info(`Initializing service: ${name}`);
        const instance = await service.factory(this);

        service.instance = instance;
        service.state = ServiceState.READY;

        this.emit("serviceReady", name);
        logger.info(`✓ Service ready: ${name}`);

        return instance as T;
      } catch (error) {
        service.state = ServiceState.FAILED;
        service.error =
          error instanceof Error ? error : new Error(String(error));

        this.emit("serviceFailed", name, service.error);
        logger.error(`✗ Service failed: ${name}`, error);

        throw service.error;
      } finally {
        this.initializationPromises.delete(name);
      }
    })();

    this.initializationPromises.set(name, initPromise);
    return initPromise;
  }

  /**
   * Initialises all non-lazy registered services in parallel
   *
   * Uses `Promise.allSettled` so a failure in one service does not block the
   * rest. All failures are logged and the `allReady` event is still emitted
   * afterward so downstream listeners can proceed.
   */
  async initializeAll(): Promise<void> {
    const nonLazyServices = Array.from(this.services.values())
      .filter((s) => !s.lazy)
      .map((s) => s.name);

    logger.info(`Initializing ${nonLazyServices.length} core services...`);

    const result = await Promise.allSettled(
      nonLazyServices.map((name) => this.get(name)),
    );

    const failed = result.filter((r) => r.status === "rejected");
    const succeeded = result.filter((r) => r.status === "fulfilled");

    logger.info(
      `Services initialized: ${succeeded.length}/${nonLazyServices.length} succeeded`,
    );

    if (failed.length > 0) {
      logger.error(`${failed.length} service(s) failed to initialize`);
      failed.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.error(`   - ${nonLazyServices[index]}: ${result.reason}`);
        }
      });
    }

    this.emit("allReady");
  }

  private checkCircularDependency(
    serviceName: string,
    visited: Set<string>,
    path: string[] = [],
  ): void {
    if (visited.has(serviceName)) {
      throw new Error(
        `Circular dependency detected: ${[...path, serviceName].join(" -> ")}`,
      );
    }

    const service = this.services.get(serviceName);
    if (!service || !service.dependencies) return;

    visited.add(serviceName);
    path.push(serviceName);

    for (const dep of service.dependencies) {
      this.checkCircularDependency(dep, new Set(visited), [...path]);
    }
  }

  /**
   * Returns a fully-initialised service instance synchronously
   *
   * Throws if the service has not yet been initialised. Use this only in
   * contexts where you are certain the service is already ready (e.g. inside
   * a request handler after startup has completed).
   */
  getSync<K extends ServiceKey>(name: K): ServiceTypeMap[K];
  getSync<T>(name: string): T;
  getSync(name: string): unknown {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} is not registered`);
    }
    if (service.state !== ServiceState.READY || !service.instance) {
      throw new Error(
        `Service ${name} is not ready (state: ${service.state}). Use async get() instead.`,
      );
    }
    return service.instance;
  }

  /** Total number of registered services */
  get size(): number {
    return this.services.size;
  }

  /** Returns the current lifecycle state of a service */
  getState(name: string): ServiceState | undefined {
    return this.services.get(name)?.state;
  }

  /** Returns a snapshot of every registered service's lifecycle state */
  getAllStates(): Record<string, ServiceState> {
    const states: Record<string, ServiceState> = {};
    for (const [name, service] of this.services) {
      states[name] = service.state;
    }
    return states;
  }

  /**
   * Shuts down all services in reverse registration order
   *
   * Calls `shutdown()` on every service instance that implements it, tolerating
   * individual failures so that all services get a chance to clean up. Clears
   * both the service registry and any pending initialisation promises.
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down services...");

    const isShutdownable = (
      instance: unknown,
    ): instance is { shutdown: () => Promise<void> | void } =>
      typeof instance === "object" &&
      instance !== null &&
      "shutdown" in instance &&
      typeof (instance as Record<string, unknown>).shutdown === "function";

    const shutdownableServices = Array.from(this.services.values())
      .filter((s) => isShutdownable(s.instance))
      .reverse();

    for (const service of shutdownableServices) {
      try {
        logger.debug(`Shutting down: ${service.name}`);
        if (isShutdownable(service.instance)) {
          await service.instance.shutdown();
        }
      } catch (error) {
        logger.error(`Failed to shutdown ${service.name}:`, error);
      }
    }

    this.services.clear();
    this.initializationPromises.clear();

    logger.info("All services shutdown");
  }
}

export const container = new ServiceContainer();

export const Services = {
  DATABASE: "database",
  HTTP_SERVER: "http.Server",
  DISCORD_MAIN_BOT: "discord.mainBot",
  MESSAGE_SERVICE: "discord.messageService",
  MESSAGE_CACHE: "discord.messageCacheService",
  TICKET_SERVICE: "discord.ticketService",
  LEADERBOARD_SERVICE: "discord.leaderboardService",
  MEMBER_CLEANUP_SERVICE: "discord.memberCleanupService",
  INACTIVITY_CLEANUP_SERVICE: "discord.inactivityCleanupService",
  GHOST_MEMBER_SERVICE: "discord.ghostMemberService",
  UNLINKED_MEMBER_SERVICE: "discord.unlinkedMemberService",
  SERVER_STATS_SERVICE: "discord.serverStatsService",
  ROTATING_STATUS_SERVICE: "discord.rotatingStatusService",
  PLAYTIME_MANAGER_SERVICE: "minecraft.playtimeManagerService",
  ROLE_MANAGEMENT_SERVICE: "discord.roleManagementService",
  WEBSOCKET_SERVICE: "http.webSocketService",
  PLAYER_BAN_SERVICE: "player.banService",
  PLAYER_DELETION_SERVICE: "player.deletionService",
  PARTY_PURGE_SERVICE: "minecraft.partyPurgeService",
  STATS_IMPORT_SERVICE: "minecraft.statsImportService",
  FAQ_SERVICE: "discord.faqService",
  PUPPETEER_SERVICE: "infra.puppeteerService",
  AI_SERVICE: "infra.aiService",
  AUTO_MESSAGE_SERVICE: "discord.autoMessageService",
  DONATION_SERVICE: "donation.service",
  STRUCTURE_PACK_ROTATION: "structurePack.rotationService",
  WAITLIST_CLEANUP_SERVICE: "waitlist.cleanupService",
  PLAYER_PROMPT_SERVICE: "player.promptService",
  WORKSHOP_PROJECT_REFRESH: "workshop.projectRefreshService",
  LAUNCHER_PACK_FILE_REFRESH: "launcher.packFileRefreshService",
  STICKY_MESSAGE_SERVICE: "discord.stickyMessageService",
  GALLERY_SERVICE: "gallery.service",
  APP_EMOJI_SERVICE: "discord.appEmojiService",
  REDIS: "infra.redisService",
  MAINTENANCE_SERVICE: "server.maintenanceService",
  VOTIFIER_SERVICE: "server.votifierService",
  VOTE_REWARD_SERVICE: "server.voteRewardService",
} as const;

export type ServiceKey = (typeof Services)[keyof typeof Services];

export interface ServiceTypeMap {
  [Services.DATABASE]: Pool;
  [Services.HTTP_SERVER]: Server;
  [Services.DISCORD_MAIN_BOT]: Client;
  [Services.MESSAGE_SERVICE]: DiscordMessageService;
  [Services.MESSAGE_CACHE]: MessageCacheService;
  [Services.TICKET_SERVICE]: TicketService;
  [Services.LEADERBOARD_SERVICE]: LeaderboardService;
  [Services.MEMBER_CLEANUP_SERVICE]: MemberCleanupService;
  [Services.INACTIVITY_CLEANUP_SERVICE]: InactivityCleanupService;
  [Services.GHOST_MEMBER_SERVICE]: GhostMemberService;
  [Services.UNLINKED_MEMBER_SERVICE]: UnlinkedMemberService;
  [Services.SERVER_STATS_SERVICE]: ServerStatsService;
  [Services.ROTATING_STATUS_SERVICE]: RotatingStatusService;
  [Services.PLAYTIME_MANAGER_SERVICE]: PlaytimeManagerService;
  [Services.ROLE_MANAGEMENT_SERVICE]: RoleManagementService;
  [Services.WEBSOCKET_SERVICE]: WebSocketService;
  [Services.PLAYER_BAN_SERVICE]: PlayerBanService;
  [Services.PLAYER_DELETION_SERVICE]: PlayerDeletionService;
  [Services.PARTY_PURGE_SERVICE]: PartyPurgeService;
  [Services.STATS_IMPORT_SERVICE]: StatsImportService;
  [Services.FAQ_SERVICE]: FaqService;
  [Services.PUPPETEER_SERVICE]: PuppeteerService;
  [Services.AI_SERVICE]: AiService;
  [Services.AUTO_MESSAGE_SERVICE]: AutoMessageService;
  [Services.DONATION_SERVICE]: DonationService;
  [Services.STRUCTURE_PACK_ROTATION]: StructurePackRotationService;
  [Services.WAITLIST_CLEANUP_SERVICE]: WaitlistCleanupService;
  [Services.PLAYER_PROMPT_SERVICE]: PlayerPromptService;
  [Services.WORKSHOP_PROJECT_REFRESH]: WorkshopProjectRefreshService;
  [Services.LAUNCHER_PACK_FILE_REFRESH]: LauncherPackFileRefreshService;
  [Services.STICKY_MESSAGE_SERVICE]: DiscordStickyMessageService;
  [Services.GALLERY_SERVICE]: GalleryService;
  [Services.APP_EMOJI_SERVICE]: AppEmojiService;
  [Services.REDIS]: RedisService;
  [Services.MAINTENANCE_SERVICE]: MaintenanceService;
  [Services.VOTIFIER_SERVICE]: VotifierService;
  [Services.VOTE_REWARD_SERVICE]: VoteRewardService;
}
