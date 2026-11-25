import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type AddressInfo, type Server, type Socket } from "net";
import { ServerRconConnection } from "@/utils/rcon/connection";
import { RconCommandError } from "@/utils/rcon/errors";

const PASSWORD = "test-password";
const TIMEOUT_MS = 100;
const AUTH = 3;
const AUTH_RESPONSE = 2;
const RESPONSE = 0;

type CommandHandler = (socket: Socket, id: number) => void;

function packet(id: number, type: number, payload: string): Buffer {
  const body = Buffer.from(payload, "utf-8");
  const buffer = Buffer.alloc(14 + body.length);
  buffer.writeInt32LE(10 + body.length, 0);
  buffer.writeInt32LE(id, 4);
  buffer.writeInt32LE(type, 8);
  body.copy(buffer, 12);
  return buffer;
}

function answer(socket: Socket, id: number): void {
  socket.write(packet(id, RESPONSE, "ok"));
}

function ignoreThenReset(socket: Socket): void {
  setTimeout(() => socket.resetAndDestroy(), TIMEOUT_MS * 1.5);
}

function waitFor(condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (condition()) return resolve();
      if (Date.now() - started > 2000) return reject(new Error("Timed out"));
      setTimeout(check, 10);
    };
    check();
  });
}

let server: Server;
let connections: Socket[];
let onCommand: CommandHandler;
let rcon: ServerRconConnection;

beforeEach(async () => {
  connections = [];
  onCommand = answer;
  server = createServer((socket) => {
    connections.push(socket);
    socket.on("error", () => {});
    let pending = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 4) {
        const length = pending.readInt32LE(0);
        if (pending.length < length + 4) break;
        const id = pending.readInt32LE(4);
        const type = pending.readInt32LE(8);
        pending = pending.subarray(length + 4);
        if (type === AUTH) socket.write(packet(id, AUTH_RESPONSE, ""));
        else onCommand(socket, id);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  rcon = new ServerRconConnection(
    1,
    "Test Server",
    { host: "127.0.0.1", port, password: PASSWORD },
    TIMEOUT_MS,
  );
});

afterEach(async () => {
  await rcon.disconnect();
  for (const socket of connections) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
});

describe("ServerRconConnection", () => {
  it("survives a reset after a command timed out and reconnects for the next one", async () => {
    onCommand = ignoreThenReset;

    await expect(rcon.send("whitelist add Steve")).rejects.toThrow(
      RconCommandError,
    );
    expect(rcon.isConnected()).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));
    onCommand = answer;

    await expect(rcon.send("list")).resolves.toBe("ok");
    expect(connections).toHaveLength(2);
  });

  it("marks a command the server never answered as possibly run", async () => {
    onCommand = () => {};

    await expect(rcon.send("give Steve diamond 1")).rejects.toMatchObject({
      mayHaveRun: true,
    });
  });

  it("marks a command that could not be sent as not run", async () => {
    const { port } = server.address() as AddressInfo;
    await new Promise((resolve) => server.close(resolve));
    server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const unreachable = new ServerRconConnection(
      1,
      "Test Server",
      { host: "127.0.0.1", port, password: PASSWORD },
      TIMEOUT_MS,
    );

    await expect(
      unreachable.send("give Steve diamond 1"),
    ).rejects.toMatchObject({ mayHaveRun: false });
  });

  it("survives a reset on an idle connection and reconnects for the next command", async () => {
    await expect(rcon.send("list")).resolves.toBe("ok");
    expect(rcon.isConnected()).toBe(true);

    connections[0].resetAndDestroy();
    await waitFor(() => !rcon.isConnected());

    await expect(rcon.send("list")).resolves.toBe("ok");
    expect(connections).toHaveLength(2);
  });
});
