type QueryValue = string | number | boolean | null | undefined;

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown,
  ) {
    super(`Request failed with status ${status}`);
    this.name = "HttpStatusError";
  }
}

export class DownloadTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Download exceeds the ${maxBytes} byte limit`);
    this.name = "DownloadTooLargeError";
  }
}

export function withQuery(
  url: string,
  params: Record<string, QueryValue | QueryValue[]>,
): string {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) {
        target.searchParams.append(key, String(item));
      }
    }
  }
  return target.toString();
}

export async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const body = await readBody(response);
  if (!response.ok) {
    throw new HttpStatusError(response.status, response.statusText, body);
  }
  return body as T;
}

export async function downloadCapped(
  url: string,
  options: { timeoutMs: number; maxBytes: number; redirect?: RequestRedirect },
): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: options.redirect,
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpStatusError(response.status, response.statusText, null);
  }
  if (Number(response.headers.get("content-length")) > options.maxBytes) {
    await response.body?.cancel();
    throw new DownloadTooLargeError(options.maxBytes);
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > options.maxBytes) {
      await reader.cancel();
      throw new DownloadTooLargeError(options.maxBytes);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function describeHttpError(error: unknown): object {
  if (error instanceof HttpStatusError) {
    return {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
    };
  }
  if (error instanceof Error) {
    const cause = error.cause as { code?: string } | undefined;
    return { name: error.name, code: cause?.code, message: error.message };
  }
  return { message: String(error) };
}
