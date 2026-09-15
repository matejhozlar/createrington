import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import config from "@/config";

export interface StoredObject {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Thin wrapper over the S3-compatible Cloudflare R2 API for the public
 * bucket of the current environment. Credentials come from the R2_* env
 * vars; when they are absent `enabled` is false and every call throws, so
 * callers gate features on `enabled` instead of catching. Keys are relative
 * to the bucket root and map one to one onto `${R2_PUBLIC_URL}/${key}`.
 * Uploads default to an immutable cache header, so keys must never be
 * reused for different content.
 */
export class ObjectStorageService {
  private client: S3Client | null = null;

  /** Whether the R2 credentials for this environment are configured. */
  get enabled(): boolean {
    return config.r2.enabled;
  }

  /** Public URL of a key, whether or not the object exists yet. */
  publicUrl(key: string): string {
    return `${config.r2.publicUrl}/${key}`;
  }

  /** Uploads one object, overwriting any existing object at the key. */
  async put(object: StoredObject): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: object.key,
        Body: object.body,
        ContentType: object.contentType,
        CacheControl: object.cacheControl ?? IMMUTABLE_CACHE_CONTROL,
      }),
    );
  }

  /** Deletes the given keys; keys that do not exist are not an error. */
  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    await this.getClient().send(
      new DeleteObjectsCommand({
        Bucket: config.r2.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  private getClient(): S3Client {
    if (!this.enabled) {
      throw new Error(
        "Object storage is not configured, set the R2_* environment variables",
      );
    }

    if (!this.client) {
      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.r2.accessKeyId,
          secretAccessKey: config.r2.secretAccessKey,
        },
      });
    }

    return this.client;
  }
}

export const objectStorage = new ObjectStorageService();
