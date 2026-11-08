import { vi, type Mock } from "vitest";
import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";

type Entry = {
  id: number;
  discordId: string;
  discordUsername: string;
  status: "queued" | "promoted" | "registered" | "expired";
  queuedAt: Date;
  promotedAt: Date | null;
  promotedBy: string | null;
  registeredAt: Date | null;
  expiredAt: Date | null;
  joinedMinecraft: boolean;
  verifyChannelId: string | null;
  waitingMessageId: string | null;
  adminMessageId: string | null;
};

class ConstraintViolationError extends Error {}
class UniqueViolationError extends ConstraintViolationError {}

type WaitlistState = {
  ConstraintViolationError: typeof ConstraintViolationError;
  UniqueViolationError: typeof UniqueViolationError;
  entries: Entry[];
  nextId: number;
  free: number;
  freeDelayMs: number;
  findAllCalls: number;
  hideNextFind: boolean;
  guildAvailable: boolean;
  memberFetch: Mock;
  channelFetch: Mock;
  adminSend: Mock;
  progressEmbed: Mock;
};

export const waitlistState: WaitlistState = {
  ConstraintViolationError,
  UniqueViolationError,
  entries: [],
  nextId: 1,
  free: 0,
  freeDelayMs: 0,
  findAllCalls: 0,
  hideNextFind: false,
  guildAvailable: true,
  memberFetch: vi.fn(),
  channelFetch: vi.fn(),
  adminSend: vi.fn(),
  progressEmbed: vi.fn(),
};
const state = waitlistState;

export function fakeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: state.nextId++,
    discordId: `user-${state.nextId}`,
    discordUsername: `user${state.nextId}`,
    status: "queued",
    queuedAt: new Date(Date.now() - state.nextId * 1000),
    promotedAt: null,
    promotedBy: null,
    registeredAt: null,
    expiredAt: null,
    joinedMinecraft: false,
    verifyChannelId: "channel-1",
    waitingMessageId: "waiting-1",
    adminMessageId: null,
    ...overrides,
  };
}

export function unknownMember(): DiscordAPIError {
  return new DiscordAPIError(
    { code: RESTJSONErrorCodes.UnknownMember, message: "Unknown Member" },
    RESTJSONErrorCodes.UnknownMember,
    404,
    "GET",
    "https://discord.com/api/v10/guilds/guild-1/members/x",
    {},
  );
}

export function resetWaitlistState(): void {
  state.entries = [];
  state.nextId = 1;
  state.free = 0;
  state.freeDelayMs = 0;
  state.findAllCalls = 0;
  state.hideNextFind = false;
  state.guildAvailable = true;
  state.memberFetch.mockReset();
  state.memberFetch.mockImplementation(async (id: string) => ({
    id,
    toString: () => `<@${id}>`,
  }));
  state.channelFetch.mockReset();
  state.channelFetch.mockImplementation(async () => ({
    isTextBased: () => true,
    isDMBased: () => false,
    messages: { fetch: async () => ({ edit: async () => undefined }) },
    send: async () => ({ id: "sent-1" }),
  }));
  state.adminSend.mockReset();
  state.adminSend.mockResolvedValue({ success: true, messageId: "admin-1" });
  state.progressEmbed.mockReset();
  state.progressEmbed.mockResolvedValue(undefined);
}
type MockFactory = () => Record<string, unknown>;

export const waitlistMocks: Record<
  | "errors"
  | "db"
  | "config"
  | "client"
  | "constants"
  | "embeds"
  | "registrationPresets"
  | "waitlistPresets"
  | "verificationChannel"
  | "errorHandler",
  MockFactory
> = {
  errors: () => ({
    ConstraintViolationError: state.ConstraintViolationError,
    UniqueViolationError: state.UniqueViolationError,
  }),
  db: () => {
    const locate = (identifier: { id?: number; discordId?: string }) =>
      state.entries.find((e) =>
        identifier.id !== undefined
          ? e.id === identifier.id
          : e.discordId === identifier.discordId,
      );

    const entry = {
      find: async (identifier: { id?: number; discordId?: string }) => {
        if (state.hideNextFind) {
          state.hideNextFind = false;
          return null;
        }
        return locate(identifier) ?? null;
      },
      get: async (identifier: { id?: number; discordId?: string }) => {
        const found = locate(identifier);
        if (!found) throw new Error("not found");
        return found;
      },
      findAll: async (
        filters: { status: Entry["status"] },
        options: { limit: number },
      ) => {
        state.findAllCalls++;
        return state.entries
          .filter((e) => e.status === filters.status)
          .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())
          .slice(0, options.limit);
      },
      count: async (filters: { status: Entry["status"] }) =>
        state.entries.filter((e) => e.status === filters.status).length,
      update: async (identifier: { id: number }, data: Partial<Entry>) => {
        const found = locate(identifier);
        if (!found) throw new Error("not found");
        if (data.status === "promoted" && found.status !== "promoted") {
          state.free--;
        }
        Object.assign(found, data);
        return found;
      },
      createAndReturn: async (data: Partial<Entry>) => {
        if (state.entries.some((e) => e.discordId === data.discordId)) {
          throw new state.UniqueViolationError("duplicate key");
        }
        const created = fakeEntry(data);
        state.entries.push(created);
        if (created.status === "promoted") state.free--;
        return created;
      },
    };

    return {
      Q: {
        waitlist: { entry },
        player: { exists: async () => false },
        discord: { guild: { member: { join: { recordJoin: async () => 1 } } } },
      },
      waitlistRepo: {
        getFreeSlots: async () => {
          if (state.freeDelayMs > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, state.freeDelayMs),
            );
          }
          return state.free;
        },
        updateProgressEmbed: state.progressEmbed,
      },
    };
  },
  config: () => ({
    default: { discord: { guild: { id: "guild-1" } } },
  }),
  client: () => ({
    mainBot: {
      guilds: {
        cache: {
          get: () =>
            state.guildAvailable
              ? { members: { fetch: state.memberFetch } }
              : undefined,
        },
      },
      channels: { fetch: state.channelFetch },
    },
  }),
  constants: () => ({
    Discord: {
      Channels: { administration: { NOTIFICATIONS: "notifications" } },
      Messages: { send: state.adminSend },
    },
  }),
  embeds: () => ({
    EmbedPresets: {
      waitlist: {
        queueNotification: () => ({
          embed: {
            setTimestamp() {
              return this;
            },
          },
          components: [],
        }),
      },
    },
  }),
  registrationPresets: () => ({
    RegistrationComponentPresets: {
      idle: () => ({ components: [], flags: 0 }),
    },
  }),
  waitlistPresets: () => ({
    WaitlistComponentPresets: { waiting: () => ({ components: [], flags: 0 }) },
  }),
  verificationChannel: () => ({
    createVerificationChannel: vi.fn(),
  }),
  errorHandler: () => ({
    BadRequestError: class BadRequestError extends Error {},
  }),
};
