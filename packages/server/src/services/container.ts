import EventEmitter from "node:events";
import type { Server } from "node:http";
import type { Pool } from "pg";
import type { Client } from "discord.js";
import type { DiscordMessageService } from "./discord/message/message.service";
import type { MessageCacheService } from "./discord/message/cache";
import type { TicketService } from "./discord/tickets";
import type { LeaderboardService } from "./discord/leaderboard";
import type { MemberCleanupService } from "./discord/cleanup/member/member-cleanup.service";
import type { ServerStatsService } from "./discord/stats";
import type { RotatingStatusService } from "./discord/status";
import type { PlaytimeManagerService } from "./playtime/playtime-manager.service";
import type { RoleManagementService } from "./discord/role/role-management.service";
import type { WebSocketService } from "./websocket";
import type { PlayerBanService } from "./player/ban";
import type { StatsImportService } from "./stats-import";
import type { AchievementService } from "./achievement";
import type { FaqService } from "./discord/faq";
import type { PuppeteerService } from "./puppeteer";
import type { CryptoMarketService } from "./crypto";

/**
 * Service lifecycle states
 */
enum ServiceState {
  UNINITIALIZED = "uninitialized",
  INITIALIZING = "initializing",
  READY = "ready",
  FAILED = "failed",
}

/**
 * Service definition with dependencies
 */
interface ServiceDefinition<T = unknown> {
  name: string;
  factory: (container: ServiceContainer) => T | Promise<T>;
  dependencies?: string[];
  lazy?: boolean;
  state: ServiceState;
  instance?: T;
  error?: Error;
}

/**
 * Container events
 */
interface ContainerEvents {
  serviceReady: (serviceName: string) => void;
  serviceFailed: (serviceName: string, error: Error) => void;
  allReady: () => void;
}

interface TypedEventEmitter<T> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(
    event: K,
    ...args: T[K] extends (...args: infer A) => unknown ? A : never
  ): boolean;
}

/**
 * Centralized service container with dependency injection
 *
 * - Manages the full lifecycle of all application services (register, init, shutdown)
 * - Resolves dependencies in parallel where possible
 * - Detects circular dependencies at init time
 * - Supports lazy services that initialize only on first access
 * - Emits events for service readiness and cross-service wiring
 */
export class ServiceContainer extends (EventEmitter as new () => TypedEventEmitter<ContainerEvents> & EventEmitter) {
  private services: Map<string, ServiceDefinition> = new Map();
  private initializationPromises: Map<string, Promise<unknown>> = new Map();

  /**
   * Register a service with its factory and dependencies
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
   * Get a service instance (initializes if needed)
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

  /**
   * Initialize a specific service and its dependencies
   */
  private async initializeService<T>(name: string): Promise<T> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }

    // Check for circular dependencies
    this.checkCircularDependency(name, new Set());

    service.state = ServiceState.INITIALIZING;

    const initPromise = (async () => {
      try {
        // Initialize dependencies first (in parallel)
        if (service.dependencies && service.dependencies.length > 0) {
          logger.debug(
            `Initializing dependencies for ${name}: ${service.dependencies.join(", ")}`,
          );
          await Promise.all(service.dependencies.map((dep) => this.get(dep)));
        }

        // Initialize the service
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
   * Initializes all non-lazy services in parallel
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

  /**
   * Check for circular dependencies
   */
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
   * Get a service instance synchronously (throws if not ready)
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

  /**
   * Number of registered services
   */
  get size(): number {
    return this.services.size;
  }

  /**
   * Get service state
   */
  getState(name: string): ServiceState | undefined {
    return this.services.get(name)?.state;
  }

  /**
   * Get all service states
   */
  getAllStates(): Record<string, ServiceState> {
    const states: Record<string, ServiceState> = {};
    for (const [name, service] of this.services) {
      states[name] = service.state;
    }
    return states;
  }

  /**
   * Shuts down all services in reverse registration order.
   * Calls `shutdown()` on any service that implements it.
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

/**
 * Type-safe service keys
 */
export const Services = {
  DATABASE: "database",
  HTTP_SERVER: "http.Server",
  DISCORD_MAIN_BOT: "discord.mainBot",
  DISCORD_WEB_BOT: "discord.webBot",
  MESSAGE_SERVICE: "discord.messageService",
  WEB_MESSAGE_SERVICE: "discord.webMessageService",
  MESSAGE_CACHE: "discord.messageCacheService",
  TICKET_SERVICE: "discord.ticketService",
  LEADERBOARD_SERVICE: "discord.leaderboardService",
  MEMBER_CLEANUP_SERVICE: "discord.memberCleanupService",
  SERVER_STATS_SERVICE: "discord.serverStatsService",
  ROTATING_STATUS_SERVICE: "discord.rotatingStatusService",
  PLAYTIME_MANAGER_SERVICE: "minecraft.playtimeManagerService",
  ROLE_MANAGEMENT_SERVICE: "discord.roleManagementService",
  WEBSOCKET_SERVICE: "http.webSocketService",
  PLAYER_BAN_SERVICE: "player.banService",
  STATS_IMPORT_SERVICE: "minecraft.statsImportService",
  ACHIEVEMENT_SERVICE: "achievement.achievementService",
  FAQ_SERVICE: "discord.faqService",
  PUPPETEER_SERVICE: "infra.puppeteerService",
  CRYPTO_MARKET_SERVICE: "crypto.marketService",
} as const;

export type ServiceKey = (typeof Services)[keyof typeof Services];

/**
 * Maps each service key to its concrete type for type-safe access
 */
export interface ServiceTypeMap {
  [Services.DATABASE]: Pool;
  [Services.HTTP_SERVER]: Server;
  [Services.DISCORD_MAIN_BOT]: Client;
  [Services.DISCORD_WEB_BOT]: Client;
  [Services.MESSAGE_SERVICE]: DiscordMessageService;
  [Services.WEB_MESSAGE_SERVICE]: DiscordMessageService;
  [Services.MESSAGE_CACHE]: MessageCacheService;
  [Services.TICKET_SERVICE]: TicketService;
  [Services.LEADERBOARD_SERVICE]: LeaderboardService;
  [Services.MEMBER_CLEANUP_SERVICE]: MemberCleanupService;
  [Services.SERVER_STATS_SERVICE]: ServerStatsService;
  [Services.ROTATING_STATUS_SERVICE]: RotatingStatusService;
  [Services.PLAYTIME_MANAGER_SERVICE]: PlaytimeManagerService;
  [Services.ROLE_MANAGEMENT_SERVICE]: RoleManagementService;
  [Services.WEBSOCKET_SERVICE]: WebSocketService;
  [Services.PLAYER_BAN_SERVICE]: PlayerBanService;
  [Services.STATS_IMPORT_SERVICE]: StatsImportService;
  [Services.ACHIEVEMENT_SERVICE]: AchievementService;
  [Services.FAQ_SERVICE]: FaqService;
  [Services.PUPPETEER_SERVICE]: PuppeteerService;
  [Services.CRYPTO_MARKET_SERVICE]: CryptoMarketService;
}
