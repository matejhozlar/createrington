import EventEmitter from "node:events";
import type {
  CachedMessage,
  MessageCacheServiceConfig,
  MessageQueryOptions,
  MinecraftMessageData,
  ParsedAttachment,
  ParsedEmbed,
  ServerCacheConfig,
  SystemMessageData,
  WebMessageData,
} from "./types";
import { MessageSource } from "./types";
import type {
  Client,
  Embed,
  Message,
  PartialMessage,
  TextChannel,
} from "discord.js";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { Q } from "@/db";
import config from "@/config";

export interface MessageCacheEvents {
  messageCreate: (serverId: number, message: CachedMessage) => void;
  messageUpdate: (serverId: number, message: CachedMessage) => void;
  messageDelete: (serverId: number, messageId: string) => void;
  cacheReady: () => void;
  /** Emitted when a "server started" embed is detected from the relay bot. */
  serverStarted: (serverId: number) => void;
  /** Emitted when a "server closed" embed is detected from the relay bot. */
  serverClosed: (serverId: number) => void;
}

interface TypedEventEmitter<T> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(
    event: K,
    ...args: T[K] extends (...args: infer A) => unknown ? A : never
  ): boolean;
}

/**
 * In-memory ring buffer of recent Discord messages per configured server.
 *
 * On init, optionally backfills history from each watched channel, then keeps
 * the cache live via messageCreate/Update/Delete listeners on the supplied
 * Discord client. Each cached entry is classified by source (System, Discord,
 * Minecraft, Web) using the bot identity and embed shape, and mentions are
 * resolved against player/role/channel maps loaded once at init. Emits typed
 * events (messageCreate/Update/Delete, cacheReady, serverStarted/Closed) for
 * downstream WebSocket fanout. The per-server buffer is bounded by
 * `maxMessages` (default 100) and trims oldest-first on overflow.
 */
export class MessageCacheService extends (EventEmitter as new () => TypedEventEmitter<MessageCacheEvents> &
  EventEmitter) {
  private cache: Map<number, CachedMessage[]> = new Map();
  private serverConfig: Map<number, ServerCacheConfig> = new Map();
  private isInitialized = false;
  private botUserId: string | null = null;

  private userMap = new Map<string, string>();
  private roleMap = new Map<string, string>();
  private channelMap = new Map<string, string>();

  constructor(
    private readonly bot: Client,
    private readonly config: MessageCacheServiceConfig,
  ) {
    super();
    for (const server of config.servers) {
      this.cache.set(server.serverId, []);
      this.serverConfig.set(server.serverId, {
        maxMessages: 100,
        ...server,
      });
    }
  }

  /**
   * Load mention maps, attach Discord listeners, and (optionally) backfill
   * history. Re-entrant: subsequent calls log a warning and return.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("MessageCacheService already initialized");
      return;
    }

    logger.info("Initializing MessageCacheService...");

    this.botUserId = this.bot.user?.id || null;
    if (!this.botUserId) {
      logger.warn(
        "MessageCacheService couldn't initialize bot ID, continuing without it",
      );
    }

    await this.loadMentionMaps();
    this.setupEventListeners();

    if (this.config.loadHistoryOnStartup) {
      await this.loadHistoricalMessages();
    }

    this.isInitialized = true;
    this.emit("cacheReady");
    logger.info(
      `MessageCacheService initialized for ${this.config.servers.length} server(s)`,
    );
  }

  private setupEventListeners(): void {
    this.bot.on("messageCreate", (message: Message) => {
      this.handleMessageCreate(message);
    });

    this.bot.on(
      "messageUpdate",
      (_oldMessage: Message | PartialMessage, newMessage: Message) => {
        this.handleMessageUpdate(newMessage);
      },
    );

    this.bot.on("messageDelete", (message: Message | PartialMessage) => {
      this.handleMessageDelete(message);
    });

    logger.debug("Message cache event listeners registered");
  }

  private async loadHistoricalMessages(): Promise<void> {
    logger.info("Loading historical messages...");

    const loadPromises = this.config.servers.map((serverConfig) =>
      this.loadChannelHistory(serverConfig),
    );

    await Promise.all(loadPromises);

    const totalMessages = Array.from(this.cache.values()).reduce(
      (sum, cache) => sum + cache.length,
      0,
    );

    logger.info(`Loaded ${totalMessages} historical messages`);
  }

  private async loadChannelHistory(
    serverConfig: ServerCacheConfig,
  ): Promise<void> {
    try {
      const channel = await this.bot.channels.fetch(serverConfig.channelId);

      if (!channel || !isSendableChannel(channel)) {
        logger.warn(
          `Channel ${serverConfig.channelId} not found or not text-based`,
        );
        return;
      }

      const textChannel = channel as TextChannel;
      const maxMessages = serverConfig.maxMessages || 100;

      const messages = await textChannel.messages.fetch({ limit: maxMessages });

      const cachedMessages = Array.from(messages.values())
        .map((msg) => this.convertToCachedMessage(msg, serverConfig.serverId))
        .reverse();

      this.cache.set(serverConfig.serverId, cachedMessages);

      logger.info(
        `Loaded ${cachedMessages.length} messages from channel ${serverConfig.channelId} (server: ${serverConfig.serverId})`,
      );
    } catch (error) {
      logger.error(
        `Failed to load history for channel ${serverConfig.channelId}`,
        error,
      );
    }
  }

  private handleMessageCreate(message: Message): void {
    const serverId = this.getServerIdForChannel(message.channelId);
    if (serverId === null) {
      return;
    }

    const cachedMessages = this.convertToCachedMessage(message, serverId);
    this.addToCache(serverId, cachedMessages);

    this.emit("messageCreate", serverId, cachedMessages);

    this.detectServerStatus(message, serverId);

    logger.debug(
      `Cached new message from ${message.author.username} (${cachedMessages.source})`,
    );
  }

  private detectServerStatus(message: Message, serverId: number): void {
    if (!message.author.bot) {
      return;
    }

    if (message.embeds.length === 0) {
      return;
    }

    const embed = message.embeds[0];
    const description = embed.description?.toLowerCase() || "";
    const title = embed.title?.toLowerCase() || "";
    const combinedText = `${title} ${description}`;

    if (combinedText.includes("server started")) {
      logger.info(`Server ${serverId} started (detected from Discord)`);
      this.emit("serverStarted", serverId);
      return;
    }

    if (combinedText.includes("server closed")) {
      logger.info(`Server ${serverId} closed (detected from Discord)`);
      this.emit("serverClosed", serverId);
    }
  }

  private handleMessageUpdate(message: Message): void {
    const serverId = this.getServerIdForChannel(message.channelId);
    if (serverId === null) {
      return;
    }

    const cache = this.cache.get(serverId);
    if (!cache) {
      return;
    }

    const index = cache.findIndex((m) => m.messageId === message.id);
    if (index !== -1) {
      const updatedMessage = this.convertToCachedMessage(message, serverId);
      cache[index] = updatedMessage;

      this.emit("messageUpdate", serverId, updatedMessage);

      logger.debug(
        `Updated cached message ${message.id} in server ${serverId}`,
      );
    }
  }

  private handleMessageDelete(message: Message | PartialMessage): void {
    const serverId = this.getServerIdForChannel(message.channelId);
    if (serverId === null) {
      return;
    }

    const cache = this.cache.get(serverId);
    if (!cache) {
      return;
    }

    const index = cache.findIndex((m) => m.messageId === message.id);
    if (index !== -1) {
      cache.splice(index, 1);

      this.emit("messageDelete", serverId, message.id);

      logger.debug(
        `Removed deleted message ${message.id} from server ${serverId}`,
      );
    }
  }

  private getServerIdForChannel(channelId: string): number | null {
    for (const [serverId, config] of this.serverConfig) {
      if (config.channelId === channelId) {
        return serverId;
      }
    }
    return null;
  }

  private detectMessageSource(message: Message): MessageSource {
    if (!message.author.bot) {
      return MessageSource.DISCORD;
    }

    if (this.botUserId && message.author.id === this.botUserId) {
      if (message.embeds.length > 0) {
        return MessageSource.SYSTEM;
      }
      return MessageSource.WEB;
    }

    const isCreateringtonBot =
      message.author.id === this.config.botConfig.createringtonBotId;
    const isCreateringtonTag =
      message.author.tag.startsWith("Createrington#") ||
      message.author.tag === "Createrington";

    if (isCreateringtonBot || isCreateringtonTag) {
      if (message.embeds.length > 0) {
        return MessageSource.SYSTEM;
      }

      return MessageSource.WEB;
    }

    return MessageSource.MINECRAFT;
  }

  private parseMinecraftData(
    message: Message,
  ): MinecraftMessageData | undefined {
    return {
      playerName: message.author.username,
    };
  }

  private parseSystemData(message: Message): SystemMessageData | undefined {
    if (message.embeds.length === 0) {
      return undefined;
    }

    const embed = message.embeds[0];
    return {
      title: embed.title || undefined,
      description: embed.description || undefined,
    };
  }

  // TODO: implement when web messages are added
  private parseWebData(_message: Message): WebMessageData | undefined {
    // TODO: Implement web message detection
    return undefined;
  }

  private parseEmbeds(embeds: Embed[]): ParsedEmbed[] {
    return embeds.map((embed) => ({
      type: embed.data?.type || undefined,
      title: this.stripBackticks(embed.title),
      description: this.stripBackticks(embed.description),
      url: embed.url || undefined,
      color: embed.color || undefined,
      timestamp: embed.timestamp || undefined,
      footer: embed.footer
        ? {
            text: this.stripBackticks(embed.footer.text) || embed.footer.text,
            iconUrl: embed.footer.iconURL || undefined,
          }
        : undefined,
      author: embed.author
        ? {
            name: embed.author.name,
            iconUrl: embed.author.iconURL || undefined,
            url: embed.author.url || undefined,
          }
        : undefined,
      fields: embed.fields?.map((field) => ({
        name: this.stripBackticks(field.name) || field.name,
        value: this.stripBackticks(field.value) || field.value,
        inline: field.inline || undefined,
      })),
      image: embed.image
        ? {
            url: embed.image.url,
            width: embed.image.width || undefined,
            height: embed.image.height || undefined,
          }
        : undefined,
      video: embed.video
        ? {
            url: embed.video.url,
            width: embed.video.width || undefined,
            height: embed.video.height || undefined,
          }
        : undefined,
      thumbnail: embed.thumbnail
        ? {
            url: embed.thumbnail.url,
            width: embed.thumbnail.width || undefined,
            height: embed.thumbnail.height || undefined,
          }
        : undefined,
    }));
  }

  private parseAttachments(
    attachments: Message["attachments"],
  ): ParsedAttachment[] {
    return Array.from(attachments.values()).map((att) => ({
      url: att.url,
      filename: att.name,
      contentType: att.contentType || undefined,
      size: att.size,
      width: att.width || undefined,
      height: att.height || undefined,
    }));
  }

  private stripBackticks(text: string | null | undefined): string | undefined {
    if (!text) {
      return undefined;
    }
    return text.replace(/`/g, "");
  }

  private async loadMentionMaps(): Promise<void> {
    const players = await Q.player.findAll(undefined, {
      select: ["discordId", "minecraftUsername"],
    });
    for (const p of players) {
      this.userMap.set(p.discordId, p.minecraftUsername);
    }

    for (const [name, id] of Object.entries(config.discord.guild.roles)) {
      if (typeof id === "string") {
        this.roleMap.set(
          id,
          name
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/^./, (c) => c.toUpperCase()),
        );
      }
    }

    for (const category of Object.values(config.discord.guild.channels)) {
      for (const [name, id] of Object.entries(
        category as Record<string, string>,
      )) {
        this.channelMap.set(
          id,
          name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
        );
      }
    }

    logger.info(
      `Loaded mention maps: ${this.userMap.size} users, ${this.roleMap.size} roles, ${this.channelMap.size} channels`,
    );
  }

  private resolveMentions(text: string): string {
    // User mentions: <@123456> or <@!123456>
    text = text.replace(/<@!?(\d+)>/g, (match, id: string) => {
      const name = this.userMap.get(id);
      return name ? `@${name}` : match;
    });
    // Role mentions: <@&123456>
    text = text.replace(/<@&(\d+)>/g, (match, id: string) => {
      const name = this.roleMap.get(id);
      return name ? `@${name}` : match;
    });
    // Channel mentions: <#123456> → markdown link to Discord channel
    const guildId = config.discord.guild.id;
    text = text.replace(/<#(\d+)>/g, (match, id: string) => {
      const name = this.channelMap.get(id);
      return name
        ? `[#${name}](https://discord.com/channels/${guildId}/${id})`
        : match;
    });
    return text;
  }

  private convertToCachedMessage(
    message: Message,
    serverId: number,
  ): CachedMessage {
    const source = this.detectMessageSource(message);

    const cached: CachedMessage = {
      messageId: message.id,
      channelId: message.channelId,
      serverId,
      authorId: message.author.id,
      authorUsername: message.author.username,
      authorTag: message.author.tag,
      authorDisplayname: message.author.displayName,
      authorAvatarUrl: message.author.displayAvatarURL({ size: 128 }),
      content: this.resolveMentions(message.content),
      createdAt: message.createdAt,
      editedAt: message.editedAt || undefined,
      attachments: this.parseAttachments(message.attachments),
      embeds: this.parseEmbeds(message.embeds),
      isBot: message.author.bot,
      referenceMessageId: message.reference?.messageId,
      source,
    };

    switch (source) {
      case MessageSource.MINECRAFT:
        cached.minecraftData = this.parseMinecraftData(message);
        break;
      case MessageSource.SYSTEM:
        cached.systemData = this.parseSystemData(message);
        break;
      case MessageSource.WEB:
        cached.webData = this.parseWebData(message);
        break;
    }

    return cached;
  }

  private addToCache(serverId: number, message: CachedMessage): void {
    const cache = this.cache.get(serverId);
    const config = this.serverConfig.get(serverId);

    if (!cache || !config) {
      return;
    }

    cache.push(message);

    const maxMessages = config.maxMessages || 100;
    if (cache.length > maxMessages) {
      cache.shift();
    }
  }

  /** Cached messages for a server, newest first, with optional filtering. */
  getMessages(
    serverId: number,
    options?: MessageQueryOptions,
  ): CachedMessage[] {
    const cache = this.cache.get(serverId);
    if (!cache) {
      return [];
    }

    let messages = [...cache].reverse();

    if (options) {
      if (options.authorId) {
        messages = messages.filter((m) => m.authorId === options.authorId);
      }

      if (options.contentContains) {
        const search = options.contentContains.toLowerCase();
        messages = messages.filter((m) =>
          m.content.toLowerCase().includes(search),
        );
      }

      if (options.after) {
        messages = messages.filter((m) => m.createdAt > options.after!);
      }

      if (options.before) {
        messages = messages.filter((m) => m.createdAt < options.before!);
      }

      if (options.limit) {
        messages = messages.slice(0, options.limit);
      }
    }

    return messages;
  }

  /** Single cached message by id, or undefined if not in the buffer. */
  getMessage(serverId: number, messageId: string): CachedMessage | undefined {
    const cache = this.cache.get(serverId);
    if (!cache) {
      return;
    }

    return cache.find((m) => m.messageId === messageId);
  }

  /** Most recent `count` messages for a server, newest first. */
  getRecentMessages(serverId: number, count: number): CachedMessage[] {
    return this.getMessages(serverId, { limit: count });
  }

  /** Per-server counts, oldest/newest timestamps, and breakdown by source. */
  getStats(): Record<
    number,
    {
      messageCount: number;
      oldestMessage?: Date | string;
      newestMessage?: Date | string;
      bySource: Record<MessageSource, number>;
    }
  > {
    const stats: ReturnType<MessageCacheService["getStats"]> = {};

    for (const [serverId, cache] of this.cache) {
      const bySource: Record<MessageSource, number> = {
        [MessageSource.SYSTEM]: 0,
        [MessageSource.DISCORD]: 0,
        [MessageSource.MINECRAFT]: 0,
        [MessageSource.WEB]: 0,
      };

      cache.forEach((msg) => {
        bySource[msg.source]++;
      });

      stats[serverId] = {
        messageCount: cache.length,
        oldestMessage: cache.length > 0 ? cache[0]!.createdAt : undefined,
        newestMessage:
          cache.length > 0 ? cache[cache.length - 1]!.createdAt : undefined,
        bySource,
      };
    }

    return stats;
  }

  /** Empty the in-memory buffer for a single server. */
  clearCache(serverId: number): void {
    const cache = this.cache.get(serverId);
    if (cache) {
      cache.length = 0;
    }
    logger.info(`Cleared cache for server ${serverId}`);
  }
}
