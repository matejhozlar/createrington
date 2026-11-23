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
import type { SessionService } from "./auth/session/session.service";
import type { LauncherSessionService } from "./auth/launcher/launcher-session.service";
import type { MinecraftRconManager } from "@/utils/rcon/manager";

export enum ServiceState {
  UNINITIALIZED = "uninitialized",
  INITIALIZING = "initializing",
  READY = "ready",
  FAILED = "failed",
}

/**
 * What the container expects of a registered service: an optional
 * `initialize()` the factory awaits before returning and an optional
 * `shutdown()` the container calls at teardown, neither taking arguments
 */
export interface Lifecycle {
  initialize?(): void | Promise<void>;
  shutdown?(): void | Promise<void>;
}

type LifecycleMap<TMap> = {
  [K in keyof TMap]: Pick<Lifecycle, Extract<keyof TMap[K], keyof Lifecycle>>;
};

type Teardown<T> = (instance: T) => void | Promise<void>;

interface RegisterOptions<T> {
  shutdown?: Teardown<T>;
}

const SHUTDOWN_TIMEOUT_MS = 10_000;

type ServiceName<TMap> = keyof TMap & string;

type ResolvedDependencies<
  TMap,
  TDependencies extends readonly ServiceName<TMap>[],
> = {
  [I in keyof TDependencies]: TDependencies[I] extends keyof TMap
    ? TMap[TDependencies[I]]
    : never;
};

interface ServiceDefinition {
  name: string;
  factory: (...dependencies: unknown[]) => unknown;
  dependencies: readonly string[];
  teardown?: Teardown<unknown>;
  state: ServiceState;
  instance?: unknown;
  error?: Error;
}

/**
 * Centralized service container with dependency injection
 *
 * A service is registered under a key of the type maps together with the
 * services it needs. The container initializes those first (in parallel),
 * hands their instances to the factory in the same order, and type-checks
 * the factory's result against the key, so the declared graph is the graph
 * the factories actually use. A required service may only depend on other
 * required services. An optional one is registered only when its feature is
 * configured and is read back with `getOptional`, which returns null instead
 * of throwing when it was never registered. Dependency cycles are rejected
 * at init time. Every registered type satisfies `Lifecycle`; a handle the app
 * does not own (pg Pool, http.Server, Discord client) passes its teardown at
 * registration instead.
 *
 * NOTE: The singleton `container` instance exported from this module is the
 * authoritative registry: all services must be registered through it before
 * `initializeAll()` is called during server startup
 */
export class ServiceContainer<
  TRequired extends LifecycleMap<TRequired>,
  TOptional extends LifecycleMap<TOptional> = Record<never, never>,
> {
  private services: Map<string, ServiceDefinition> = new Map();
  private initializationPromises: Map<string, Promise<unknown>> = new Map();

  /**
   * Registers a service with the services its factory receives, in order
   *
   * Duplicate registrations throw immediately to catch wiring mistakes early.
   * `options.shutdown` replaces the instance's own `shutdown()` at teardown.
   */
  register<
    K extends ServiceName<TRequired & TOptional>,
    const D extends readonly ServiceName<TRequired>[],
  >(
    name: K,
    dependencies: D,
    factory: (
      ...dependencies: ResolvedDependencies<TRequired, D>
    ) => (TRequired & TOptional)[K] | Promise<(TRequired & TOptional)[K]>,
    options: RegisterOptions<(TRequired & TOptional)[K]> = {},
  ): void {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }

    this.services.set(name, {
      name,
      factory: factory as (...dependencies: unknown[]) => unknown,
      dependencies,
      teardown: options.shutdown as Teardown<unknown> | undefined,
      state: ServiceState.UNINITIALIZED,
    });

    logger.debug(`Registered service: ${name}`);
  }

  /**
   * Returns a fully-initialised required service, initialising it on first access
   *
   * Concurrent callers share one factory run, and a previously-failed service
   * re-throws its original error.
   */
  async get<K extends ServiceName<TRequired>>(name: K): Promise<TRequired[K]> {
    return (await this.resolve(name)) as TRequired[K];
  }

  /** Same as `get` for an optional service, or null when it was never registered. */
  async getOptional<K extends ServiceName<TOptional>>(
    name: K,
  ): Promise<TOptional[K] | null> {
    if (!this.services.has(name)) return null;
    return (await this.resolve(name)) as TOptional[K];
  }

  /**
   * Returns a fully-initialised required service synchronously
   *
   * Throws if the service has not yet been initialised. Use this only in
   * contexts where you are certain the service is already ready (e.g. inside
   * a request handler after startup has completed).
   */
  getSync<K extends ServiceName<TRequired>>(name: K): TRequired[K] {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} is not registered`);
    }
    if (service.state !== ServiceState.READY) {
      throw new Error(
        `Service ${name} is not ready (state: ${service.state}). Use async get() instead.`,
      );
    }
    return service.instance as TRequired[K];
  }

  /** Returns the instance of a ready service, or null; never throws and never starts initialisation. */
  getIfReady<K extends ServiceName<TRequired & TOptional>>(
    name: K,
  ): (TRequired & TOptional)[K] | null {
    const service = this.services.get(name);
    if (service?.state !== ServiceState.READY) return null;
    return service.instance as (TRequired & TOptional)[K];
  }

  private async resolve(name: string): Promise<unknown> {
    const service = this.services.get(name);

    if (!service) {
      throw new Error(`Service ${name} is not registered`);
    }

    if (service.state === ServiceState.READY) {
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

    return this.initializeService(service);
  }

  private initializeService(service: ServiceDefinition): Promise<unknown> {
    const { name } = service;

    this.checkCircularDependency(name, new Set());

    service.state = ServiceState.INITIALIZING;

    const initPromise = (async () => {
      try {
        if (service.dependencies.length > 0) {
          logger.debug(
            `Initializing dependencies for ${name}: ${service.dependencies.join(", ")}`,
          );
        }
        const dependencies = await Promise.all(
          service.dependencies.map((dep) => this.resolve(dep)),
        );

        logger.info(`Initializing service: ${name}`);
        const instance = await service.factory(...dependencies);

        service.instance = instance;
        service.state = ServiceState.READY;

        logger.info(`✓ Service ready: ${name}`);

        return instance;
      } catch (error) {
        service.state = ServiceState.FAILED;
        service.error =
          error instanceof Error ? error : new Error(String(error));

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
   * Initialises every registered service in parallel
   *
   * Uses `Promise.allSettled` so a failure in one service does not block the
   * rest. All failures are logged.
   */
  async initializeAll(): Promise<void> {
    const names = Array.from(this.services.keys());

    logger.info(`Initializing ${names.length} core services...`);

    const results = await Promise.allSettled(
      names.map((name) => this.resolve(name)),
    );

    const failed = results.filter((r) => r.status === "rejected");

    logger.info(
      `Services initialized: ${names.length - failed.length}/${names.length} succeeded`,
    );

    if (failed.length > 0) {
      logger.error(`${failed.length} service(s) failed to initialize`);
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.error(`   - ${names[index]}: ${result.reason}`);
        }
      });
    }
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
    if (!service) return;

    visited.add(serviceName);
    path.push(serviceName);

    for (const dep of service.dependencies) {
      this.checkCircularDependency(dep, new Set(visited), [...path]);
    }
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
   * Shuts down all ready services in reverse registration order
   *
   * Runs each service's registered teardown, or its own `shutdown()`, giving
   * each one at most 10 seconds and moving on past a failure or a timeout so
   * every service gets a chance to clean up. Clears the registry afterwards.
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down services...");

    const ready = Array.from(this.services.values())
      .filter((s) => s.state === ServiceState.READY)
      .reverse();

    for (const service of ready) {
      const teardown = this.teardownOf(service);
      if (!teardown) continue;

      logger.debug(`Shutting down: ${service.name}`);
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          teardown(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(`timed out after ${SHUTDOWN_TIMEOUT_MS / 1000}s`),
                ),
              SHUTDOWN_TIMEOUT_MS,
            );
          }),
        ]);
      } catch (error) {
        logger.error(`Failed to shutdown ${service.name}:`, error);
      } finally {
        clearTimeout(timer);
      }
    }

    this.services.clear();
    this.initializationPromises.clear();

    logger.info("All services shutdown");
  }

  private teardownOf(
    service: ServiceDefinition,
  ): (() => void | Promise<void>) | null {
    const { instance, teardown } = service;
    if (teardown) return () => teardown(instance);
    const own = (instance as Lifecycle | null | undefined)?.shutdown;
    if (typeof own === "function") return () => own.call(instance);
    return null;
  }
}

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
  RCON_MANAGER: "minecraft.rconManager",
  SESSION_SERVICE: "auth.sessionService",
  LAUNCHER_SESSION_SERVICE: "auth.launcherSessionService",
  MAINTENANCE_SERVICE: "server.maintenanceService",
  VOTIFIER_SERVICE: "server.votifierService",
  VOTE_REWARD_SERVICE: "server.voteRewardService",
} as const;

export interface RequiredServiceTypeMap {
  [Services.DATABASE]: Pool;
  [Services.HTTP_SERVER]: Server;
  [Services.RCON_MANAGER]: MinecraftRconManager;
  [Services.SESSION_SERVICE]: SessionService;
  [Services.LAUNCHER_SESSION_SERVICE]: LauncherSessionService;
  [Services.DISCORD_MAIN_BOT]: Client;
  [Services.MESSAGE_SERVICE]: DiscordMessageService;
  [Services.MESSAGE_CACHE]: MessageCacheService;
  [Services.TICKET_SERVICE]: TicketService;
  [Services.LEADERBOARD_SERVICE]: LeaderboardService;
  [Services.MEMBER_CLEANUP_SERVICE]: MemberCleanupService;
  [Services.GHOST_MEMBER_SERVICE]: GhostMemberService;
  [Services.UNLINKED_MEMBER_SERVICE]: UnlinkedMemberService;
  [Services.SERVER_STATS_SERVICE]: ServerStatsService;
  [Services.ROTATING_STATUS_SERVICE]: RotatingStatusService;
  [Services.PLAYTIME_MANAGER_SERVICE]: PlaytimeManagerService;
  [Services.ROLE_MANAGEMENT_SERVICE]: RoleManagementService;
  [Services.WEBSOCKET_SERVICE]: WebSocketService;
  [Services.PLAYER_BAN_SERVICE]: PlayerBanService;
  [Services.PLAYER_DELETION_SERVICE]: PlayerDeletionService;
  [Services.FAQ_SERVICE]: FaqService;
  [Services.PUPPETEER_SERVICE]: PuppeteerService;
  [Services.AUTO_MESSAGE_SERVICE]: AutoMessageService;
  [Services.STRUCTURE_PACK_ROTATION]: StructurePackRotationService;
  [Services.PLAYER_PROMPT_SERVICE]: PlayerPromptService;
  [Services.WORKSHOP_PROJECT_REFRESH]: WorkshopProjectRefreshService;
  [Services.STICKY_MESSAGE_SERVICE]: DiscordStickyMessageService;
  [Services.GALLERY_SERVICE]: GalleryService;
  [Services.APP_EMOJI_SERVICE]: AppEmojiService;
  [Services.MAINTENANCE_SERVICE]: MaintenanceService;
}

export interface OptionalServiceTypeMap {
  [Services.INACTIVITY_CLEANUP_SERVICE]: InactivityCleanupService;
  [Services.PARTY_PURGE_SERVICE]: PartyPurgeService;
  [Services.STATS_IMPORT_SERVICE]: StatsImportService;
  [Services.AI_SERVICE]: AiService;
  [Services.DONATION_SERVICE]: DonationService;
  [Services.WAITLIST_CLEANUP_SERVICE]: WaitlistCleanupService;
  [Services.LAUNCHER_PACK_FILE_REFRESH]: LauncherPackFileRefreshService;
  [Services.REDIS]: RedisService;
  [Services.VOTIFIER_SERVICE]: VotifierService;
  [Services.VOTE_REWARD_SERVICE]: VoteRewardService;
}

export type ServiceTypeMap = RequiredServiceTypeMap & OptionalServiceTypeMap;
export type RequiredServiceKey = keyof RequiredServiceTypeMap;
export type OptionalServiceKey = keyof OptionalServiceTypeMap;
export type ServiceKey = RequiredServiceKey | OptionalServiceKey;

export const container = new ServiceContainer<
  RequiredServiceTypeMap,
  OptionalServiceTypeMap
>();
