import { AppError } from "@/errors";
import type {
  LauncherContentErrorCode,
  LauncherPackErrorCode,
} from "@createrington/shared/launcher";

export function launcherError(
  code: LauncherContentErrorCode | LauncherPackErrorCode,
  statusCode: number,
  message: string,
  headers?: Record<string, string>,
): AppError {
  return new AppError(message, statusCode, true, undefined, { code, headers });
}
