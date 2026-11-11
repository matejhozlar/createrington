import { useCallback, useEffect, useRef, useState } from "react";
import { useToastActions } from "@/hooks/use-toast";

const COPIED_RESET_MS = 1500;

interface UseClipboardOptions {
  success?: string;
  error?: string;
  silent?: boolean;
}

export function useClipboard({
  success = "Copied to clipboard",
  error = "Failed to copy to clipboard",
  silent = false,
}: UseClipboardOptions = {}) {
  const toast = useToastActions();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const copy = useCallback(
    async (content: string | Blob): Promise<boolean> => {
      try {
        if (typeof content === "string") {
          await navigator.clipboard.writeText(content);
        } else {
          await navigator.clipboard.write([
            new ClipboardItem({ [content.type]: content }),
          ]);
        }
      } catch {
        if (!silent) toast.error(error);
        return false;
      }
      if (!silent) toast.success(success);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      return true;
    },
    [toast, success, error, silent],
  );

  return { copy, copied };
}
