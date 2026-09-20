import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

type RenderPage = "activity" | "compare" | "profile" | "records" | "top";

export function useRenderData<T>(
  page: RenderPage,
  paramKeys: readonly string[] = [],
) {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);

  const entries = paramKeys.map((key) => [key, searchParams.get(key) ?? ""]);
  const hasMissingParams = entries.some(([, value]) => !value);
  const query = new URLSearchParams(entries).toString();

  useEffect(() => {
    if (hasMissingParams) return;

    const url = new URL(`/api/render/${page}`, window.location.origin);
    url.search = query;

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<T>;
      })
      .then(setData)
      .catch(() => setFailed(true));
  }, [hasMissingParams, page, query]);

  return { data, unavailable: hasMissingParams || failed };
}
