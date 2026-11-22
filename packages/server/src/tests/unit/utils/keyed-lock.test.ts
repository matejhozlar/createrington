import { describe, it, expect } from "vitest";
import { createKeyedLock } from "@/utils/keyed-lock";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("createKeyedLock", () => {
  it("runs work on the same key one after another", async () => {
    const withLock = createKeyedLock<number>();
    const gate = deferred();
    const order: string[] = [];

    const first = withLock(1, async () => {
      order.push("first start");
      await gate.promise;
      order.push("first end");
    });
    const second = withLock(1, async () => {
      order.push("second");
    });

    await Promise.resolve();
    expect(order).toEqual(["first start"]);

    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(["first start", "first end", "second"]);
  });

  it("does not hold up work on another key", async () => {
    const withLock = createKeyedLock<number>();
    const gate = deferred();

    const blocked = withLock(1, () => gate.promise);
    const other = await withLock(2, async () => "done");

    expect(other).toBe("done");
    gate.resolve();
    await blocked;
  });

  it("keeps running queued work after a failure and still rejects the caller", async () => {
    const withLock = createKeyedLock<string>();

    const failing = withLock("a", async () => {
      throw new Error("boom");
    });
    const next = withLock("a", async () => 42);

    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe(42);
  });
});
