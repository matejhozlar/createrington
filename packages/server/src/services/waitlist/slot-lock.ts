let slotLock: Promise<unknown> = Promise.resolve();

export function withSlotLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = slotLock.then(fn, fn);
  slotLock = run.catch(() => undefined);
  return run;
}
