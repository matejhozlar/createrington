import { AppError } from "@/app/middleware/error-handler";
import type { LauncherPackErrorCode } from "@createrington/shared/launcher";

export function packError(
  code: LauncherPackErrorCode,
  statusCode: number,
  message: string,
): AppError {
  return new AppError(message, statusCode, true, undefined, { code });
}
