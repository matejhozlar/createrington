import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { RenderPage, RenderPayloads } from "@createrington/shared/render";

export type RenderUnavailableReason = "rejected" | "failed";

type RenderResult<T> =
  | { request: string; data: T; unavailable: null }
  | { request: string; data: null; unavailable: RenderUnavailableReason };

const GATE_REJECTION_STATUSES = [401, 403];

export function useRenderData<P extends RenderPage>(
  page: P,
  paramKeys: readonly string[] = [],
): {
  data: RenderPayloads[P] | null;
  unavailable: RenderUnavailableReason | null;
} {
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<RenderResult<RenderPayloads[P]> | null>(
    null,
  );

  const entries = paramKeys.map((key) => [key, searchParams.get(key) ?? ""]);
  const hasMissingParams = entries.some(([, value]) => !value);
  const query = new URLSearchParams(entries).toString();
  const request = query
    ? `/api/render/${page}?${query}`
    : `/api/render/${page}`;

  useEffect(() => {
    if (hasMissingParams) return;
    let active = true;

    void fetch(request)
      .then(async (res): Promise<RenderResult<RenderPayloads[P]>> => {
        if (GATE_REJECTION_STATUSES.includes(res.status)) {
          return { request, data: null, unavailable: "rejected" };
        }
        if (!res.ok) throw new Error("Bad response");
        return {
          request,
          data: (await res.json()) as RenderPayloads[P],
          unavailable: null,
        };
      })
      .catch((): RenderResult<RenderPayloads[P]> => ({
        request,
        data: null,
        unavailable: "failed",
      }))
      .then((next) => {
        if (active) setResult(next);
      });

    return () => {
      active = false;
    };
  }, [hasMissingParams, request]);

  if (hasMissingParams) return { data: null, unavailable: "rejected" };

  const current = result?.request === request ? result : null;
  return {
    data: current?.data ?? null,
    unavailable: current?.unavailable ?? null,
  };
}
