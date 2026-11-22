import { describe, it, expect, vi } from "vitest";
import { ServiceContainer, ServiceState } from "@/services/container";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

interface Named {
  name: string;
}

type Services = Record<
  "db" | "cache" | "api" | "a" | "b" | "c" | "svc" | "missing",
  object
>;

describe("ServiceContainer", () => {
  it("initializes dependencies first and hands them to the factory in order", async () => {
    const container = new ServiceContainer<{
      db: Named;
      cache: Named;
      api: { db: Named; cache: Named };
    }>();
    const order: string[] = [];
    container.register("db", [], () => {
      order.push("db");
      return { name: "db" };
    });
    container.register("cache", ["db"], () => {
      order.push("cache");
      return { name: "cache" };
    });
    container.register("api", ["db", "cache"], (db, cache) => {
      order.push("api");
      return { db, cache };
    });

    const api = await container.get("api");

    expect(api.db.name).toBe("db");
    expect(api.cache.name).toBe("cache");
    expect(order).toEqual(["db", "cache", "api"]);
  });

  it("runs a shared dependency's factory once when several services wait on it", async () => {
    const container = new ServiceContainer<Services>();
    const gate = deferred<{ ok: true }>();
    const dbFactory = vi.fn(() => gate.promise);
    container.register("db", [], dbFactory);
    container.register("a", ["db"], () => ({}));
    container.register("b", ["db"], () => ({}));

    const both = Promise.all([container.get("a"), container.get("b")]);
    gate.resolve({ ok: true });
    await both;

    expect(dbFactory).toHaveBeenCalledTimes(1);
  });

  it("returns the cached instance on later calls", async () => {
    const container = new ServiceContainer<Services>();
    const factory = vi.fn(() => ({}));
    container.register("svc", [], factory);

    const first = await container.get("svc");
    const second = await container.get("svc");

    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("rejects a dependency cycle and names the path", async () => {
    const container = new ServiceContainer<Services>();
    container.register("a", ["b"], () => ({}));
    container.register("b", ["c"], () => ({}));
    container.register("c", ["a"], () => ({}));

    await expect(container.get("a")).rejects.toThrow(
      "Circular dependency detected: a -> b -> c -> a",
    );
  });

  it("allows two services to share a dependency without calling it a cycle", async () => {
    const container = new ServiceContainer<Services>();
    container.register("db", [], () => ({}));
    container.register("a", ["db"], () => ({}));
    container.register("b", ["db", "a"], () => ({}));

    await expect(container.get("b")).resolves.toEqual({});
  });

  it("throws from getSync until the service is ready", async () => {
    const container = new ServiceContainer<Services>();
    const gate = deferred<{ ready: true }>();
    container.register("svc", [], () => gate.promise);

    expect(() => container.getSync("svc")).toThrow(
      "Service svc is not ready (state: uninitialized)",
    );

    const pending = container.get("svc");
    expect(() => container.getSync("svc")).toThrow("state: initializing");

    gate.resolve({ ready: true });
    await pending;
    expect(container.getSync("svc")).toEqual({ ready: true });
  });

  it("returns null from getIfReady until the service is ready, without starting it", async () => {
    const container = new ServiceContainer<Services>();
    const factory = vi.fn(() => ({ ready: true }));
    container.register("svc", [], factory);

    expect(container.getIfReady("svc")).toBeNull();
    expect(container.getIfReady("missing")).toBeNull();
    expect(factory).not.toHaveBeenCalled();

    await container.get("svc");
    expect(container.getIfReady("svc")).toEqual({ ready: true });
  });

  it("throws for a required service that was never registered", async () => {
    const container = new ServiceContainer<Services>();

    await expect(container.get("missing")).rejects.toThrow(
      "Service missing is not registered",
    );
    expect(() => container.getSync("missing")).toThrow(
      "Service missing is not registered",
    );
  });

  it("resolves an optional service to null when it was never registered", async () => {
    const container = new ServiceContainer<
      Services,
      { stripe: Named; ai: Named }
    >();
    container.register("ai", [], () => ({ name: "ai" }));

    await expect(container.getOptional("stripe")).resolves.toBeNull();
    await expect(container.getOptional("ai")).resolves.toEqual({ name: "ai" });
  });

  it("refuses to register the same name twice", () => {
    const container = new ServiceContainer<Services>();
    container.register("svc", [], () => ({}));

    expect(() => container.register("svc", [], () => ({}))).toThrow(
      "Service svc is already registered",
    );
  });

  it("marks a failed service FAILED, rethrows its error and fails its dependents", async () => {
    const container = new ServiceContainer<Services>();
    const boom = new Error("no connection");
    container.register("db", [], () => {
      throw boom;
    });
    container.register("api", ["db"], () => ({}));

    await expect(container.get("api")).rejects.toBe(boom);
    await expect(container.get("db")).rejects.toBe(boom);
    expect(container.getState("db")).toBe(ServiceState.FAILED);
    expect(container.getState("api")).toBe(ServiceState.FAILED);
  });

  it("initializes every service even when one fails", async () => {
    const container = new ServiceContainer<Services>();
    container.register("a", [], () => {
      throw new Error("broken");
    });
    container.register("b", [], () => ({}));

    await container.initializeAll();

    expect(container.getAllStates()).toEqual({
      a: ServiceState.FAILED,
      b: ServiceState.READY,
    });
  });

  it("shuts services down in reverse registration order and keeps going past a failure", async () => {
    const container = new ServiceContainer<
      Record<"first" | "second" | "plain" | "third", object>
    >();
    const order: string[] = [];
    container.register("first", [], () => ({
      shutdown: () => {
        order.push("first");
      },
    }));
    container.register("second", [], () => ({
      shutdown: () => {
        order.push("second");
        throw new Error("stuck");
      },
    }));
    container.register("plain", [], () => ({}));
    container.register("third", [], () => ({
      shutdown: () => {
        order.push("third");
        return Promise.resolve();
      },
    }));
    await container.initializeAll();

    await container.shutdown();

    expect(order).toEqual(["third", "second", "first"]);
    expect(container.size).toBe(0);
  });

  it("runs the teardown passed at registration with the instance", async () => {
    const container = new ServiceContainer<{
      pool: { end: () => void; shutdown?: () => void };
    }>();
    const end = vi.fn();
    const ownShutdown = vi.fn();
    container.register("pool", [], () => ({ end, shutdown: ownShutdown }), {
      shutdown: (pool) => pool.end(),
    });
    await container.initializeAll();

    await container.shutdown();

    expect(end).toHaveBeenCalledTimes(1);
    expect(ownShutdown).not.toHaveBeenCalled();
  });

  it("skips a service that never became ready", async () => {
    const container = new ServiceContainer<Record<"broken", object>>();
    const teardown = vi.fn();
    container.register(
      "broken",
      [],
      () => {
        throw new Error("boom");
      },
      { shutdown: teardown },
    );
    await container.initializeAll();

    await container.shutdown();

    expect(teardown).not.toHaveBeenCalled();
  });

  it("moves on from a teardown that never settles after 10 seconds", async () => {
    vi.useFakeTimers();
    try {
      const container = new ServiceContainer<
        Record<"first" | "hung", object>
      >();
      const first = vi.fn();
      container.register("first", [], () => ({ shutdown: first }));
      container.register("hung", [], () => ({
        shutdown: () => new Promise<void>(() => {}),
      }));
      await container.initializeAll();

      const done = container.shutdown();
      await vi.advanceTimersByTimeAsync(10_000);
      await done;

      expect(first).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
