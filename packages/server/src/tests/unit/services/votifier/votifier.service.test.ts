import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import net from "node:net";
import {
  VotifierService,
  type VoteListener,
} from "@/services/votifier/votifier.service";
import { encodeVoteFrame } from "@/services/votifier/protocol";

const TOKEN = "unit-test-token-with-enough-length";
const VOTE = { serviceName: "createmodservers.com", username: "Agent772" };

interface Exchange {
  greeting: string;
  response: string;
}

function talk(
  port: number,
  build: (challenge: string) => Buffer | null,
): Promise<Exchange> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    let greeting = "";
    let response = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      if (!greeting) {
        greeting = chunk.slice(0, chunk.indexOf("\n"));
        const challenge = greeting.replace("VOTIFIER 2 ", "");
        const frame = build(challenge);
        if (frame) socket.write(frame);
        return;
      }
      response += chunk;
    });
    socket.on("end", () => resolve({ greeting, response: response.trim() }));
    socket.on("error", reject);
  });
}

let service: VotifierService;
let onVote: Mock<VoteListener>;

beforeEach(async () => {
  onVote = vi.fn<VoteListener>().mockResolvedValue(undefined);
  service = new VotifierService(
    { host: "127.0.0.1", port: 0, token: TOKEN, connectionTimeoutMs: 500 },
    onVote,
  );
  await service.initialize();
});

afterEach(async () => {
  await service.shutdown();
});

describe("VotifierService", () => {
  it("greets with protocol 2 and a fresh challenge per connection", async () => {
    const [first, second] = await Promise.all([
      talk(service.port, () => null),
      talk(service.port, () => null),
    ]);

    expect(first.greeting).toMatch(/^VOTIFIER 2 [0-9a-f-]{36}$/);
    expect(second.greeting).toMatch(/^VOTIFIER 2 [0-9a-f-]{36}$/);
    expect(first.greeting).not.toBe(second.greeting);
  });

  it("hands a signed vote to the listener and acknowledges it", async () => {
    const { response } = await talk(service.port, (challenge) =>
      encodeVoteFrame({ ...VOTE, timestamp: 1788984909 }, TOKEN, challenge),
    );

    expect(response).toBe('{"status":"ok"}');
    expect(onVote).toHaveBeenCalledWith({
      serviceName: VOTE.serviceName,
      username: VOTE.username,
      timestamp: new Date(1788984909 * 1000),
    });
  });

  it("assembles a frame that arrives in several chunks", async () => {
    const { response } = await new Promise<Exchange>((resolve, reject) => {
      const socket = net.connect({ host: "127.0.0.1", port: service.port });
      let greeting = "";
      let response = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => {
        if (!greeting) {
          greeting = chunk.slice(0, chunk.indexOf("\n"));
          const frame = encodeVoteFrame(
            VOTE,
            TOKEN,
            greeting.replace("VOTIFIER 2 ", ""),
          );
          socket.write(frame.subarray(0, 3));
          setTimeout(() => socket.write(frame.subarray(3, 20)), 20);
          setTimeout(() => socket.write(frame.subarray(20)), 40);
          return;
        }
        response += chunk;
      });
      socket.on("end", () => resolve({ greeting, response: response.trim() }));
      socket.on("error", reject);
    });

    expect(response).toBe('{"status":"ok"}');
    expect(onVote).toHaveBeenCalledTimes(1);
  });

  it("answers with an error and keeps the listener out of it for a bad signature", async () => {
    const { response } = await talk(service.port, (challenge) =>
      encodeVoteFrame(VOTE, "a-different-token-of-length", challenge),
    );

    expect(response).toBe(
      '{"status":"error","error":"signature verification failed"}',
    );
    expect(onVote).not.toHaveBeenCalled();
  });

  it("closes a connection that does not open with the v2 magic", async () => {
    const { response } = await talk(service.port, () =>
      Buffer.alloc(256, 0x41),
    );

    expect(response).toBe("");
    expect(onVote).not.toHaveBeenCalled();
  });

  it("reports a listener failure as an error status", async () => {
    onVote.mockRejectedValueOnce(new Error("database down"));

    const { response } = await talk(service.port, (challenge) =>
      encodeVoteFrame(VOTE, TOKEN, challenge),
    );

    expect(response).toBe(
      '{"status":"error","error":"vote could not be processed"}',
    );
  });

  it("drops a connection that sends nothing before the timeout", async () => {
    const { response } = await talk(service.port, () => null);

    expect(response).toBe("");
    expect(onVote).not.toHaveBeenCalled();
  });

  it("stops accepting connections after shutdown", async () => {
    const port = service.port;
    await service.shutdown();

    await expect(talk(port, () => null)).rejects.toThrow();
    expect(service.port).toBe(0);
  });

  it("refuses connections beyond the configured cap", async () => {
    const capped = new VotifierService(
      {
        host: "127.0.0.1",
        port: 0,
        token: TOKEN,
        connectionTimeoutMs: 500,
        maxConnections: 1,
      },
      onVote,
    );
    await capped.initialize();
    try {
      const held = net.connect({ host: "127.0.0.1", port: capped.port });
      await new Promise<void>((resolve) => held.once("data", () => resolve()));

      const refused = await talk(capped.port, () => null).catch(() => ({
        greeting: "",
        response: "",
      }));

      expect(refused.greeting).toBe("");
      held.destroy();
    } finally {
      await capped.shutdown();
    }
  });
});
