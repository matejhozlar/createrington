import { describe, it, expect, vi } from "vitest";
import { ServiceContainer, ServiceState } from "@/services/container";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("ServiceContainer", () => {
  it("initializes dependencies before the service that needs them", async () => {
    const container = new ServiceContainer();
    const order: string[] = [];
    container.register("db", () => {
      order.push("db");
      return { name: "db" };
    });
    container.register(
      "cache",
      () => {
        order.push("cache");
        return { name: "cache" };
      },
      { dependencies: ["db"] },
    );
    container.register(
      "api",
      (c) => {
        order.push("api");
        return { db: c.getSync<{ name: string }>("db") };
      },
      { dependencies: ["db", "cache"] },
    );

    const api = await container.get<{ db: { name: string } }>("api");

    expect(api.db.name).toBe("db");
    expect(order).toEqual(["db", "cache", "api"]);
  });

  it("runs a shared dependency's factory once when several services wait on it", async () => {
    const container = new ServiceContainer();
    const gate = deferred<{ ok: true }>();
    const dbFactory = vi.fn(() => gate.promise);
    container.register("db", dbFactory);
    container.register("a", () => ({}), { dependencies: ["db"] });
    container.register("b", () => ({}), { dependencies: ["db"] });

    const both = Promise.all([container.get("a"), container.get("b")]);
    gate.resolve({ ok: true });
    await both;

    expect(dbFactory).toHaveBeenCalledTimes(1);
  });

  it("returns the cached instance on later calls", async () => {
    const container = new ServiceContainer();
    const factory = vi.fn(() => ({}));
    container.register("svc", factory);

    const first = await container.get("svc");
    const second = await container.get("svc");

    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("rejects a dependency cycle and names the path", async () => {
    const container = new ServiceContainer();
    container.register("a", () => ({}), { dependencies: ["b"] });
    container.register("b", () => ({}), { dependencies: ["c"] });
    container.register("c", () => ({}), { dependencies: ["a"] });

    await expect(container.get("a")).rejects.toThrow(
      "Circular dependency detected: a -> b -> c -> a",
    );
  });

  it("allows two services to share a dependency without calling it a cycle", async () => {
    const container = new ServiceContainer();
    container.register("db", () => ({}));
    container.register("a", () => ({}), { dependencies: ["db"] });
    container.register("b", () => ({}), { dependencies: ["db", "a"] });

    await expect(container.get("b")).resolves.toEqual({});
  });

  it("throws from getSync until the service is ready", async () => {
    const container = new ServiceContainer();
    const gate = deferred<{ ready: true }>();
    container.register("svc", () => gate.promise);

    expect(() => container.getSync("svc")).toThrow(
      "Service svc is not ready (state: uninitialized)",
    );

    const pending = container.get("svc");
    expect(() => container.getSync("svc")).toThrow("state: initializing");

    gate.resolve({ ready: true });
    await pending;
    expect(container.getSync("svc")).toEqual({ ready: true });
  });

  it("throws for a service that was never registered", async () => {
    const container = new ServiceContainer();

    await expect(container.get("missing")).rejects.toThrow(
      "Service missing is not registered",
    );
    expect(() => container.getSync("missing")).toThrow(
      "Service missing is not registered",
    );
  });

  it("refuses to register the same name twice", () => {
    const container = new ServiceContainer();
    container.register("svc", () => ({}));

    expect(() => container.register("svc", () => ({}))).toThrow(
      "Service svc is already registered",
    );
  });

  it("marks a failed service FAILED, rethrows its error and fails its dependents", async () => {
    const container = new ServiceContainer();
    const boom = new Error("no connection");
    const onFailed = vi.fn();
    container.on("serviceFailed", onFailed);
    container.register("db", () => {
      throw boom;
    });
    container.register("api", () => ({}), { dependencies: ["db"] });

    await expect(container.get("api")).rejects.toBe(boom);
    await expect(container.get("db")).rejects.toBe(boom);
    expect(container.getState("db")).toBe(ServiceState.FAILED);
    expect(container.getState("api")).toBe(ServiceState.FAILED);
    expect(onFailed).toHaveBeenCalledWith("db", boom);
  });

  it("initializes every non-lazy service even when one fails, then emits allReady", async () => {
    const container = new ServiceContainer();
    const lazyFactory = vi.fn(() => ({}));
    const onAllReady = vi.fn();
    container.on("allReady", onAllReady);
    container.register("broken", () => {
      throw new Error("broken");
    });
    container.register("healthy", () => ({}));
    container.register("lazy", lazyFactory, { lazy: true });

    await container.initializeAll();

    expect(container.getAllStates()).toEqual({
      broken: ServiceState.FAILED,
      healthy: ServiceState.READY,
      lazy: ServiceState.UNINITIALIZED,
    });
    expect(lazyFactory).not.toHaveBeenCalled();
    expect(onAllReady).toHaveBeenCalledTimes(1);
  });

  it("shuts services down in reverse registration order and keeps going past a failure", async () => {
    const container = new ServiceContainer();
    const order: string[] = [];
    container.register("first", () => ({
      shutdown: () => {
        order.push("first");
      },
    }));
    container.register("second", () => ({
      shutdown: () => {
        order.push("second");
        throw new Error("stuck");
      },
    }));
    container.register("plain", () => ({}));
    container.register("third", () => ({
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
});
