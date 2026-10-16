import { InternalServerError } from "@/app/middleware";

export async function runSync(
  label: string,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    logger.error(`Failed to process ${label}:`, error);
    throw new InternalServerError(
      `Failed to process ${label}. Please try again.`,
    );
  }
}
