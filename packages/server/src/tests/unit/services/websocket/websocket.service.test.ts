import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";

vi.mock("@/services/auth/jwt", () => ({ jwtService: { verify: vi.fn() } }));
vi.mock("@/services/websocket/data-provider", () => ({
  WebSocketDataProvider: class {},
}));

import { WebSocketService } from "@/services/websocket/websocket.service";
import {
  MAX_INITIAL_MESSAGE_LIMIT,
  parseInitialDataRequest,
  parseSubscriptionRequest,
  rejectedSubscription,
  splitFrame,
} from "@/services/websocket/request-validation";
import { SocketEvent, SubscriptionType } from "@createrington/shared/socket";

type Handler = (...args: unknown[]) => void;

interface FakeSocket {
  id: string;
  data: Record<string, unknown>;
  handshake: { address: string; headers: Record<string, string>; auth: {} };
  on: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
}

function connectFakeSocket(service: WebSocketService) {
  const io = (
    service as unknown as {
      io: { listeners(event: string): Handler[] };
    }
  ).io;
  const onConnection = io.listeners(SocketEvent.CONNECTION)[0];
  const handlers = new Map<string, Handler>();
  const socket: FakeSocket = {
    id: "fake-socket",
    data: {},
    handshake: { address: "127.0.0.1", headers: {}, auth: {} },
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    join: vi.fn(async () => {}),
    leave: vi.fn(async () => {}),
    emit: vi.fn(),
  };
  onConnection(socket);
  const send = (event: SocketEvent, ...args: unknown[]) => {
    const handler = handlers.get(event);
    if (!handler) throw new Error(`no handler registered for ${event}`);
    handler(...args);
  };
  return { socket, send };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe("WebSocketService inbound event handling", () => {
  let service: WebSocketService;
  const unhandled = vi.fn();

  beforeEach(() => {
    unhandled.mockReset();
    process.on("unhandledRejection", unhandled);
    service = new WebSocketService(createServer());
  });

  afterEach(() => {
    process.off("unhandledRejection", unhandled);
  });

  it.each([
    ["no payload", []],
    ["null payload", [null]],
    ["string payload", ["players"]],
    ["unknown type", [{ type: "nope" }]],
    ["string serverId", [{ type: "players", serverId: "1" }]],
    ["negative serverId", [{ type: "players", serverId: -1 }]],
  ])(
    "rejects a subscribe frame with %s without crashing",
    async (_label, args) => {
      const { socket, send } = connectFakeSocket(service);
      const ack = vi.fn();

      expect(() => send(SocketEvent.SUBSCRIBE, ...args, ack)).not.toThrow();
      await settle();

      expect(ack).toHaveBeenCalledTimes(1);
      expect(ack.mock.calls[0][0]).toMatchObject({
        success: false,
        error: "Invalid subscription request",
      });
      expect(socket.join).not.toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    },
  );

  it("survives a subscribe frame whose ack is not a function", async () => {
    const { socket, send } = connectFakeSocket(service);

    expect(() =>
      send(SocketEvent.SUBSCRIBE, undefined, "not-a-fn"),
    ).not.toThrow();
    expect(() =>
      send(SocketEvent.SUBSCRIBE, { type: SubscriptionType.PLAYERS }, 42),
    ).not.toThrow();
    await settle();

    expect(socket.join).toHaveBeenCalledWith(SubscriptionType.PLAYERS);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("rejects a malformed unsubscribe frame without crashing", async () => {
    const { socket, send } = connectFakeSocket(service);
    const ack = vi.fn();

    expect(() => send(SocketEvent.UNSUBSCRIBE, ack)).not.toThrow();
    expect(() => send(SocketEvent.UNSUBSCRIBE, undefined, ack)).not.toThrow();
    await settle();

    expect(ack).toHaveBeenCalledTimes(2);
    expect(ack.mock.calls[0][0]).toMatchObject({ success: false });
    expect(ack.mock.calls[1][0]).toMatchObject({ success: false });
    expect(socket.leave).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("rejects a malformed initial data request with an error event", async () => {
    const { socket, send } = connectFakeSocket(service);
    const ack = vi.fn();

    expect(() =>
      send(SocketEvent.REQUEST_INITIAL_DATA, { serverId: "x" }, ack),
    ).not.toThrow();
    expect(() =>
      send(
        SocketEvent.REQUEST_INITIAL_DATA,
        { messageLimit: MAX_INITIAL_MESSAGE_LIMIT + 1 },
        ack,
      ),
    ).not.toThrow();
    await settle();

    expect(ack).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledTimes(2);
    expect(socket.emit.mock.calls[0][0]).toBe(SocketEvent.ERROR);
    expect(socket.emit.mock.calls[0][1]).toMatchObject({
      message: "Invalid initial data request",
    });
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("answers a payload-less initial data request with the default snapshot", async () => {
    const { socket, send } = connectFakeSocket(service);
    const snapshot = { servers: [], messages: {} };
    const getInitialData = vi.fn(async () => snapshot);
    (service as unknown as { dataProvider: unknown }).dataProvider = {
      getInitialData,
      getServerInitialData: vi.fn(),
    };
    const ack = vi.fn();

    expect(() => send(SocketEvent.REQUEST_INITIAL_DATA, ack)).not.toThrow();
    await settle();

    expect(getInitialData).toHaveBeenCalledWith(true, 50);
    expect(ack).toHaveBeenCalledWith(snapshot);
    expect(socket.emit).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("still joins rooms and acks success for a valid subscribe", async () => {
    const { socket, send } = connectFakeSocket(service);
    const ack = vi.fn();

    send(
      SocketEvent.SUBSCRIBE,
      { type: SubscriptionType.PLAYERS, serverId: 1 },
      ack,
    );
    await settle();

    expect(socket.join).toHaveBeenCalledWith(`${SubscriptionType.PLAYERS}:1`);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack.mock.calls[0][0]).toMatchObject({
      success: true,
      type: SubscriptionType.PLAYERS,
      serverId: 1,
    });
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("acks a rate-limited subscribe without touching the payload", async () => {
    const { send } = connectFakeSocket(service);
    const ack = vi.fn();

    for (let i = 0; i < 60; i += 1) {
      send(SocketEvent.SUBSCRIBE, { type: SubscriptionType.ALL }, vi.fn());
    }
    send(SocketEvent.SUBSCRIBE, undefined, ack);
    await settle();

    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack.mock.calls[0][0]).toMatchObject({
      success: false,
      error: "Rate limited",
    });
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe("request-validation helpers", () => {
  it("parses the shapes the web client sends", () => {
    expect(parseSubscriptionRequest({ type: "all" })).toEqual({ type: "all" });
    expect(
      parseSubscriptionRequest({ type: "server:status", serverId: 2 }),
    ).toEqual({ type: "server:status", serverId: 2 });
    expect(parseInitialDataRequest(undefined)).toEqual({});
    expect(
      parseInitialDataRequest({
        serverId: 1,
        includeMessages: true,
        messageLimit: 100,
      }),
    ).toEqual({ serverId: 1, includeMessages: true, messageLimit: 100 });
  });

  it("rejects anything outside the contract", () => {
    expect(parseSubscriptionRequest(undefined)).toBeNull();
    expect(parseSubscriptionRequest({})).toBeNull();
    expect(parseSubscriptionRequest({ type: "all", serverId: 1.5 })).toBeNull();
    expect(parseInitialDataRequest({ messageLimit: 0 })).toBeNull();
    expect(parseInitialDataRequest({ includeMessages: "yes" })).toBeNull();
    expect(parseInitialDataRequest("x")).toBeNull();
  });

  it("only treats functions as acks and echoes a string type back on rejection", () => {
    const fn = () => {};
    const payload = { type: "all" };
    expect(splitFrame(undefined, undefined)).toEqual({ payload: undefined });
    expect(splitFrame(payload, "cb")).toEqual({ payload });
    expect(splitFrame(payload, fn)).toEqual({ payload, ack: fn });
    expect(splitFrame(fn, undefined)).toEqual({ payload: undefined, ack: fn });
    expect(splitFrame(fn, "cb")).toEqual({ payload: fn });
    expect(rejectedSubscription(undefined, "e")).toEqual({
      type: "",
      room: "",
      success: false,
      error: "e",
    });
    expect(rejectedSubscription({ type: "players" }, "e").type).toBe("players");
    expect(rejectedSubscription({ type: 5 }, "e").type).toBe("");
  });
});
