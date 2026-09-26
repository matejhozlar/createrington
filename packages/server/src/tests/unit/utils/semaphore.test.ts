import { describe, it, expect } from "vitest";
import { Semaphore } from "@/utils/semaphore";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("Semaphore", () => {
  it("runs at most `limit` tasks at once and starts queued tasks as slots free up", async () => {
    const semaphore = new Semaphore(2);
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];

    const runs = gates.map((gate, index) =>
      semaphore.run(async () => {
        started.push(index);
        await gate.promise;
      }),
    );

    await flush();
    expect(started).toEqual([0, 1]);

    gates[0].resolve();
    await flush();
    expect(started).toEqual([0, 1, 2]);

    gates[1].resolve();
    gates[2].resolve();
    await Promise.all(runs);
  });

  it("returns the task's result", async () => {
    const semaphore = new Semaphore(1);

    await expect(semaphore.run(async () => 42)).resolves.toBe(42);
  });

  it("frees the slot when a task throws", async () => {
    const semaphore = new Semaphore(1);
    const failing = deferred();

    const first = semaphore.run(() => failing.promise);
    const second = semaphore.run(async () => "ran");

    failing.reject(new Error("boom"));

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ran");
  });
});
