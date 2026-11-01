import net from "node:net";
import {
  createChallenge,
  encodeResponse,
  greeting,
  readFrame,
  verifyFrame,
  type VotifierVote,
} from "./protocol";

export interface VotifierServiceOptions {
  host: string;
  port: number;
  token: string;
  connectionTimeoutMs?: number;
}

export type VoteListener = (vote: VotifierVote) => Promise<void>;

const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Votifier Service
 *
 * TCP listener for server-list votes speaking NuVotifier protocol v2: it
 * greets every connection with a fresh challenge, reads one length-prefixed
 * JSON frame, checks the HMAC-SHA256 signature against the shared token and
 * the challenge, hands the vote to the listener and answers with the v2
 * status line. Connections that open with anything but the v2 magic (the
 * RSA-encrypted v1 block among them) are closed without a reply. Only runs
 * when a port and token are configured; the listener's failures are reported
 * to the sender as an error status so the vote is not acknowledged.
 */
export class VotifierService {
  private server: net.Server | null = null;
  private readonly sockets = new Set<net.Socket>();

  constructor(
    private readonly options: VotifierServiceOptions,
    private readonly onVote: VoteListener,
  ) {}

  /** Binds the listener; resolves once the port is open. */
  async initialize(): Promise<void> {
    const server = net.createServer((socket) => this.handleConnection(socket));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.options.port, this.options.host, () => {
        server.off("error", reject);
        resolve();
      });
    });
    server.on("error", (error) => {
      logger.error("Votifier listener error:", error);
    });
    this.server = server;
    logger.info(`Votifier listener bound on ${this.options.host}:${this.port}`);
  }

  /** Port the listener is bound to, 0 while it is not running. */
  get port(): number {
    const address = this.server?.address();
    return typeof address === "object" && address ? address.port : 0;
  }

  /** Stops accepting votes and drops every open connection. */
  async shutdown(): Promise<void> {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    logger.info("Votifier listener stopped");
  }

  private handleConnection(socket: net.Socket): void {
    this.sockets.add(socket);
    socket.setTimeout(
      this.options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS,
    );

    const remote = socket.remoteAddress ?? "unknown";
    const challenge = createChallenge();
    let buffer = Buffer.alloc(0);
    let consumed = false;

    socket.on("data", (chunk: Buffer) => {
      if (consumed) return;
      buffer = Buffer.concat([buffer, chunk]);
      const frame = readFrame(buffer);
      if (frame.status === "incomplete") return;
      consumed = true;
      if (frame.status === "unsupported") {
        logger.warn(`Votifier: closed a non-v2 vote connection from ${remote}`);
        socket.end();
        return;
      }
      void this.acceptFrame(socket, frame.body, challenge, remote);
    });
    socket.on("timeout", () => {
      logger.warn(`Votifier: connection from ${remote} timed out`);
      socket.destroy();
    });
    socket.on("error", (error) => {
      logger.debug(`Votifier: connection from ${remote} failed: ${error}`);
    });
    socket.on("close", () => {
      this.sockets.delete(socket);
    });

    socket.write(greeting(challenge));
  }

  private async acceptFrame(
    socket: net.Socket,
    body: string,
    challenge: string,
    remote: string,
  ): Promise<void> {
    const verified = verifyFrame(body, this.options.token, challenge);
    if (!verified.ok) {
      logger.warn(
        `Votifier: rejected a vote from ${remote}: ${verified.error}`,
      );
      socket.end(encodeResponse("error", verified.error));
      return;
    }

    try {
      await this.onVote(verified.vote);
      socket.end(encodeResponse("ok"));
    } catch (error) {
      logger.error(
        `Votifier: failed to process the vote of ${verified.vote.username} from ${verified.vote.serviceName}:`,
        error,
      );
      socket.end(encodeResponse("error", "vote could not be processed"));
    }
  }
}
