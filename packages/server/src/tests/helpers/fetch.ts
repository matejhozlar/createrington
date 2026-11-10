import type { Mock } from "vitest";

type FetchMock = Mock<typeof fetch>;

export function requestedUrl(fetchMock: FetchMock, call = 0): URL {
  const input = fetchMock.mock.calls[call]?.[0];
  return new URL(input instanceof Request ? input.url : String(input));
}

export function sentJson(fetchMock: FetchMock, call = 0): unknown {
  const body = fetchMock.mock.calls[call]?.[1]?.body;
  if (typeof body !== "string") throw new Error("Expected a JSON string body");
  return JSON.parse(body);
}
