const LOOKUP_BUDGET_MS = 20_000;
const LOOKUP_CONCURRENCY = 8;

export async function findFileUrls<T extends { fileId: number }>(
  files: T[],
  findUrl: (file: T, signal: AbortSignal) => Promise<string | null>,
  budgetMs = LOOKUP_BUDGET_MS,
): Promise<Map<number, string>> {
  const found = new Map<number, string>();
  if (files.length === 0) return found;

  const signal = AbortSignal.timeout(budgetMs);
  const queue = [...files];
  await Promise.all(
    Array.from(
      { length: Math.min(LOOKUP_CONCURRENCY, queue.length) },
      async () => {
        for (let file = queue.shift(); file; file = queue.shift()) {
          if (signal.aborted) return;
          const url = await findUrl(file, signal);
          if (url) found.set(file.fileId, url);
        }
      },
    ),
  );
  return found;
}
