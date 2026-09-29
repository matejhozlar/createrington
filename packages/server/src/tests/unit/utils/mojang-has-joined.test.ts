import { describe, it, expect, afterEach, vi } from "vitest";
import { verifyMojangJoin } from "@/utils/mojang-has-joined";

const SERVER_ID = "a".repeat(40);

function stubFetch(response: { status: number; body?: unknown }) {
  const fetchMock = vi.fn(async (_url: URL) => ({
    status: response.status,
    json: async () => response.body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("verifyMojangJoin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the verified profile with a dashed lowercase uuid", async () => {
    stubFetch({
      status: 200,
      body: { id: "069A79F444E94726A5BEFCA90E38AAF5", name: "Notch" },
    });

    expect(await verifyMojangJoin("notch", SERVER_ID)).toEqual({
      uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      username: "Notch",
    });
  });

  it("sends username and serverId to the hasJoined endpoint", async () => {
    const fetchMock = stubFetch({ status: 204 });

    await verifyMojangJoin("Notch", SERVER_ID);

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe(
      "https://sessionserver.mojang.com/session/minecraft/hasJoined",
    );
    expect(url.searchParams.get("username")).toBe("Notch");
    expect(url.searchParams.get("serverId")).toBe(SERVER_ID);
  });

  it("returns null when Mojang reports no join (204)", async () => {
    stubFetch({ status: 204 });

    expect(await verifyMojangJoin("Notch", SERVER_ID)).toBeNull();
  });

  it("returns null when the profile body is malformed", async () => {
    stubFetch({ status: 200, body: { id: "not-a-uuid", name: "Notch" } });

    expect(await verifyMojangJoin("Notch", SERVER_ID)).toBeNull();
  });

  it("throws on an unexpected status so the caller can report an outage", async () => {
    stubFetch({ status: 503 });

    await expect(verifyMojangJoin("Notch", SERVER_ID)).rejects.toThrow(
      "Mojang hasJoined lookup failed (503)",
    );
  });
});
