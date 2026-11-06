import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import config from "@/config";
import { getMinecraftJavaMajorVersion } from "@/services/content-gateway/minecraft";

const fetchMock = vi.fn<typeof fetch>();

function requestedUrl(call = 0): URL {
  const input = fetchMock.mock.calls[call]?.[0];
  return new URL(input instanceof Request ? input.url : String(input));
}
const GATEWAY = { url: "http://gateway.test:5005", token: "t".repeat(32) };
const originalGateway = config.contentGateway;

type GatewayConfig = { contentGateway: typeof config.contentGateway };

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeAll(() => {
  (config as GatewayConfig).contentGateway = GATEWAY;
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  (config as GatewayConfig).contentGateway = originalGateway;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("getMinecraftJavaMajorVersion", () => {
  it("asks the gateway for the version and answers the Java it names", async () => {
    fetchMock.mockResolvedValue(
      answer({
        id: "1.21.1",
        type: "release",
        releaseTime: "2024-08-08T12:24:45+00:00",
        javaMajor: 21,
      }),
    );

    expect(await getMinecraftJavaMajorVersion("1.21.1")).toBe(21);
    expect(requestedUrl().pathname).toBe("/v1/minecraft/versions/1.21.1");
  });

  it("answers null when Mojang names no Java for the version", async () => {
    fetchMock.mockResolvedValue(
      answer({ id: "1.0", type: "release", releaseTime: "", javaMajor: null }),
    );

    expect(await getMinecraftJavaMajorVersion("1.0")).toBeNull();
  });

  it("answers null for a version Mojang does not list", async () => {
    fetchMock.mockResolvedValue(
      answer({ code: "UNKNOWN_VERSION", message: "no such version" }, 404),
    );

    expect(await getMinecraftJavaMajorVersion("9.9.9")).toBeNull();
  });

  it("throws when the gateway cannot answer", async () => {
    fetchMock.mockResolvedValue(
      answer({ code: "UPSTREAM_UNREACHABLE", message: "Mojang is down" }, 502),
    );

    await expect(getMinecraftJavaMajorVersion("1.21.1")).rejects.toMatchObject({
      name: "ContentGatewayError",
      code: "UPSTREAM_UNREACHABLE",
    });
  });
});
