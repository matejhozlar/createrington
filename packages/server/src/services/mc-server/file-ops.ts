import fs from "node:fs/promises";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import config from "@/config";

/**
 * Returns the local path for the Minecraft server data directory, or null
 * if not configured (meaning SFTP should be used instead).
 */
export function getLocalPath(): string | null {
  return config.mcServer.localPath;
}

/**
 * SFTP credentials are shared across environments (dev + production both point
 * to the same game server). Only the production site should perform SFTP
 * operations to avoid the dev environment accidentally modifying server files.
 */
export function isSftpAllowed(): boolean {
  return !config.envMode.isDev && !config.envMode.isDevDeployment;
}

/** Whether any file operations are possible (local or SFTP) */
export function isFileOpsAllowed(): boolean {
  return getLocalPath() !== null || isSftpAllowed();
}

/** Resolves SFTP config for a given server ID */
function getSftpConfig(serverId: number) {
  if (serverId === config.servers.cogs.id) {
    return config.servers.cogs.sftp;
  }
  throw new Error(`No SFTP config for server ${serverId}`);
}

/** Resolves the SFTP base path for a server */
function getBasePath(serverId: number): string {
  const sftpConfig = getSftpConfig(serverId);
  const parts = sftpConfig.statsPath.split("/");
  if (parts.length >= 3) {
    return parts.slice(0, -2).join("/") || ".";
  }
  return ".";
}

/** Creates a connected SFTP client */
async function createSftpClient(): Promise<SftpClient> {
  const sftpConfig = getSftpConfig(config.servers.cogs.id);
  const sftp = new SftpClient();
  await sftp.connect({
    host: sftpConfig.host,
    port: sftpConfig.port,
    username: sftpConfig.username,
    password: sftpConfig.password,
  });
  return sftp;
}

/** Gets the SFTP base path for the default server */
function getDefaultBasePath(): string {
  return getBasePath(config.servers.cogs.id);
}

// =============================================================================
// File operations — local or SFTP, selected by config
// =============================================================================

export async function renameFile(from: string, to: string): Promise<void> {
  const localPath = getLocalPath();
  if (localPath) {
    await fs.rename(path.join(localPath, from), path.join(localPath, to));
  } else {
    const basePath = getDefaultBasePath();
    const sftp = await createSftpClient();
    try {
      await sftp.rename(`${basePath}/${from}`, `${basePath}/${to}`);
    } finally {
      await sftp.end();
    }
  }
}

export async function writeFile(
  name: string,
  content: string | Buffer,
): Promise<void> {
  const localPath = getLocalPath();
  if (localPath) {
    await fs.writeFile(
      path.join(localPath, name),
      content,
      typeof content === "string" ? "utf-8" : undefined,
    );
  } else {
    const basePath = getDefaultBasePath();
    const sftp = await createSftpClient();
    try {
      const buf = typeof content === "string" ? Buffer.from(content) : content;
      await sftp.put(buf, `${basePath}/${name}`);
    } finally {
      await sftp.end();
    }
  }
}

export async function deleteFile(name: string): Promise<void> {
  const localPath = getLocalPath();
  if (localPath) {
    await fs.unlink(path.join(localPath, name)).catch(() => {});
  } else {
    const basePath = getDefaultBasePath();
    const sftp = await createSftpClient();
    try {
      const exists = await sftp.exists(`${basePath}/${name}`);
      if (exists) await sftp.delete(`${basePath}/${name}`);
    } finally {
      await sftp.end();
    }
  }
}

export async function fileExists(name: string): Promise<boolean> {
  const localPath = getLocalPath();
  if (localPath) {
    try {
      await fs.access(path.join(localPath, name));
      return true;
    } catch {
      return false;
    }
  } else {
    const basePath = getDefaultBasePath();
    const sftp = await createSftpClient();
    try {
      const exists = await sftp.exists(`${basePath}/${name}`);
      return exists !== false;
    } finally {
      await sftp.end();
    }
  }
}

/**
 * Copies a local file to the server's data directory.
 * In local mode, copies the file directly.
 * In SFTP mode, uploads the file via SFTP.
 */
export async function copyFileToServer(
  localSrcPath: string,
  serverDestPath: string,
): Promise<void> {
  const localPath = getLocalPath();
  if (localPath) {
    const destFull = path.join(localPath, serverDestPath);
    await fs.mkdir(path.dirname(destFull), { recursive: true });
    await fs.copyFile(localSrcPath, destFull);
  } else {
    const basePath = getDefaultBasePath();
    const sftp = await createSftpClient();
    try {
      await sftp.put(localSrcPath, `${basePath}/${serverDestPath}`);
    } finally {
      await sftp.end();
    }
  }
}

/**
 * Reads a file from the server's data directory.
 * Returns the file contents as a Buffer.
 */
export async function readFile(name: string): Promise<Buffer> {
  const localPath = getLocalPath();
  if (localPath) {
    return fs.readFile(path.join(localPath, name));
  } else {
    const basePath = getDefaultBasePath();
    const sftp = await createSftpClient();
    try {
      const data = await sftp.get(`${basePath}/${name}`);
      return Buffer.isBuffer(data) ? data : Buffer.from(data as string);
    } finally {
      await sftp.end();
    }
  }
}
