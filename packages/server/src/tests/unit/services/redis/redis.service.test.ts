import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { clients, createClient, connecting } = vi.hoisted(() => {
  const connecting = { failure: null as Error | null };

  function makeClient() {
    const handlers = new Map<string, (payload?: unknown) => void>();
    return {
      isReady: false,
      isOpen: false,
      on(event: string, handler: (payload?: unknown) => void) {
        handlers.set(event, handler);
        return this;
      },
      emit(event: string, payload?: unknown) {
        handlers.get(event)?.(payload);
      },
      async connect() {
        this.isOpen = true;
        if (connecting.failure) throw connecting.failure;
      },
      sendCommand: vi.fn(async (_args: string[]): Promise<unknown> => "OK"),
      destroy: vi.fn(),
    };
  }

  const clients: ReturnType<typeof makeClient>[] = [];
  const createClient = vi.fn((_options: unknown) => {
    const client = makeClient();
    clients.push(client);
    return client;
  });
  return { clients, createClient, connecting };
});

vi.mock("@redis/client", () => ({ createClient }));

import { RedisService } from "@/services/redis";

const URL = "redis://localhost:6380";

function connected() {
  const service = new RedisService(URL);
  service.initialize();
  const client = clients[0]!;
  client.isReady = true;
  client.emit("ready");
  return { service, client };
}

beforeEach(() => {
  clients.length = 0;
  connecting.failure = null;
  createClient.mockClear();
  vi.spyOn(logger, "warn").mockImplementation(() => logger);
  vi.spyOn(logger, "info").mockImplementation(() => logger);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RedisService", () => {
  it("stays off without a URL", async () => {
    const service = new RedisService(null);
    service.initialize();

    expect(service.enabled).toBe(false);
    expect(service.isReady).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    await expect(service.sendCommand(["PING"])).rejects.toThrow(
      "Redis is not connected",
    );
  });

  it("connects once, however often it is initialized", () => {
    const service = new RedisService(URL);
    service.initialize();
    service.initialize();

    expect(service.enabled).toBe(true);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ url: URL, disableOfflineQueue: true }),
    );
  });

  it("rejects a command at once while Redis is not connected", async () => {
    const service = new RedisService(URL);
    service.initialize();

    await expect(service.sendCommand(["GET", "key"])).rejects.toThrow(
      "Redis is not connected",
    );
    expect(clients[0]!.sendCommand).not.toHaveBeenCalled();
  });

  it("sends a command and answers its reply once connected", async () => {
    const { service, client } = connected();
    client.sendCommand.mockResolvedValue("value");

    expect(service.isReady).toBe(true);
    expect(await service.sendCommand(["GET", "key"])).toBe("value");
    expect(client.sendCommand).toHaveBeenCalledWith(["GET", "key"]);
  });

  it("does not fail the start of the app when Redis is down", async () => {
    connecting.failure = new Error("connect ECONNREFUSED");
    const service = new RedisService(URL);

    expect(() => service.initialize()).not.toThrow();
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(1));
    expect(service.isReady).toBe(false);
  });

  it("logs losing Redis once, however often the client reports it", () => {
    const { client } = connected();

    client.isReady = false;
    client.emit("error", new Error("Socket closed unexpectedly"));
    client.emit("error", new Error("connect ECONNREFUSED"));
    client.emit("error", new Error("connect ECONNREFUSED"));

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Socket closed unexpectedly"),
    );
  });

  it("logs getting Redis back once, and losing it again after that", () => {
    const { client } = connected();
    vi.mocked(logger.info).mockClear();

    client.isReady = false;
    client.emit("error", new Error("connect ECONNREFUSED"));
    client.isReady = true;
    client.emit("ready");
    client.emit("ready");
    client.isReady = false;
    client.emit("error", new Error("connect ECONNREFUSED"));

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it("passes on a command that fails and logs it at most once a minute", async () => {
    vi.useFakeTimers();
    const { service, client } = connected();
    client.sendCommand.mockRejectedValue(new Error("OOM command not allowed"));

    await expect(service.sendCommand(["SET", "a", "1"])).rejects.toThrow("OOM");
    await expect(service.sendCommand(["SET", "b", "1"])).rejects.toThrow("OOM");
    expect(logger.warn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    await expect(service.sendCommand(["SET", "c", "1"])).rejects.toThrow("OOM");
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it("leaves a command that failed with the lost connection to the one log line about losing Redis", async () => {
    const { service, client } = connected();
    client.sendCommand.mockImplementation(async () => {
      client.isReady = false;
      throw new Error("Socket closed unexpectedly");
    });

    await expect(service.sendCommand(["GET", "key"])).rejects.toThrow(
      "Socket closed unexpectedly",
    );
    client.emit("error", new Error("Socket closed unexpectedly"));

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("rejects a command Redis does not answer after a second", async () => {
    vi.useFakeTimers();
    const { service, client } = connected();
    client.sendCommand.mockReturnValue(new Promise(() => {}));

    const unanswered = expect(
      service.sendCommand(["GET", "key"]),
    ).rejects.toThrow("Redis did not answer within 1000 ms");
    await vi.advanceTimersByTimeAsync(999);
    expect(logger.warn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await unanswered;
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("cannot be reached"),
    );
  });

  it("leaves Redis alone for a while after a command it did not answer", async () => {
    vi.useFakeTimers();
    const { service, client } = connected();
    vi.mocked(logger.info).mockClear();
    client.sendCommand.mockReturnValueOnce(new Promise(() => {}));

    const unanswered = expect(
      service.sendCommand(["GET", "key"]),
    ).rejects.toThrow("Redis did not answer");
    await vi.advanceTimersByTimeAsync(1000);
    await unanswered;

    expect(service.isReady).toBe(false);
    await expect(service.sendCommand(["GET", "key"])).rejects.toThrow(
      "Redis is not connected",
    );
    expect(client.sendCommand).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(6000);
    expect(service.isReady).toBe(true);
    expect(await service.sendCommand(["GET", "key"])).toBe("OK");
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("uses Redis at once again when the connection was made anew", async () => {
    vi.useFakeTimers();
    const { service, client } = connected();
    client.sendCommand.mockReturnValueOnce(new Promise(() => {}));

    const unanswered = expect(
      service.sendCommand(["GET", "key"]),
    ).rejects.toThrow("Redis did not answer");
    await vi.advanceTimersByTimeAsync(1000);
    await unanswered;
    client.emit("ready");

    expect(service.isReady).toBe(true);
  });

  it("answers a reply that arrives within the second", async () => {
    vi.useFakeTimers();
    const { service, client } = connected();
    client.sendCommand.mockReturnValue(
      new Promise((resolve) => setTimeout(() => resolve("late"), 900)),
    );

    const reply = service.sendCommand(["GET", "key"]);
    await vi.advanceTimersByTimeAsync(900);

    expect(await reply).toBe("late");
  });

  it("keeps counting Redis as up when the client reports an error while connected", () => {
    const { client } = connected();
    vi.mocked(logger.info).mockClear();

    client.emit("error", new Error("could not parse a reply"));
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("while connected"),
    );

    client.isReady = false;
    client.emit("error", new Error("Socket closed unexpectedly"));
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenLastCalledWith(
      expect.stringContaining("cannot be reached"),
    );

    client.isReady = true;
    client.emit("ready");
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("closes the connection on shutdown and rejects commands afterwards", async () => {
    const { service, client } = connected();

    service.shutdown();

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(service.isReady).toBe(false);
    await expect(service.sendCommand(["PING"])).rejects.toThrow(
      "Redis is not connected",
    );
  });
});
