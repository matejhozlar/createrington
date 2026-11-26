const MIXED_BATCH_STATUS = 207;

interface BatchItem {
  error?: { data?: { httpStatus?: number } };
}

export async function isUnauthorizedBatch(
  response: Response,
  method: string | undefined,
): Promise<boolean> {
  if (response.status === 401) return true;
  if (response.status !== MIXED_BATCH_STATUS) return false;
  if ((method ?? "GET").toUpperCase() !== "GET") return false;

  try {
    const body: unknown = await response.clone().json();
    return (
      Array.isArray(body) &&
      body.some(
        (item: BatchItem | null) => item?.error?.data?.httpStatus === 401,
      )
    );
  } catch {
    return false;
  }
}
