import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import {
  DesignCodeError,
  parseDesignCode,
  type PlateDesign,
} from "@createrington/shared/team-prefix";
import { useToastActions } from "@/hooks/use-toast";

const SHARE_PARAM = "design";

export function shareLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?${SHARE_PARAM}=${code}`;
}

export function useSharedDesign(load: (design: PlateDesign) => void) {
  const [params, setParams] = useSearchParams();
  const toast = useToastActions();
  const handled = useRef(false);
  const shared = params.get(SHARE_PARAM);

  useEffect(() => {
    if (shared === null) {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    try {
      load(parseDesignCode(shared));
      toast.success("Design loaded");
    } catch (caught) {
      if (!(caught instanceof DesignCodeError)) throw caught;
      toast.error(caught.message, "This link has no valid design");
    }
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(SHARE_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [shared, setParams, load, toast]);
}
