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
