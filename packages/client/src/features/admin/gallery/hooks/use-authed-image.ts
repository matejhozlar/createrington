import { useEffect, useState } from "react";
import { api } from "@/services/api/client";
import { apiPath } from "../format";

interface AuthedImageState {
  source: string;
  objectUrl: string | null;
  failed: boolean;
}

export function useAuthedImage(source: string | null) {
  const [state, setState] = useState<AuthedImageState | null>(null);

  useEffect(() => {
    if (!source) return;

    let active = true;
    let created: string | null = null;

    api
      .download(apiPath(source))
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setState({ source, objectUrl: created, failed: false });
      })
      .catch(() => {
        if (active) setState({ source, objectUrl: null, failed: true });
      });

    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [source]);

  const current = state && state.source === source ? state : null;

  return {
    objectUrl: current?.objectUrl ?? null,
    failed: current?.failed ?? false,
    loading: !!source && current === null,
  };
}
