import { useCallback } from "react";
import { useToastActions } from "@/hooks/use-toast";

/**
 * Returns a clipboard copy handler that stops event propagation, writes the
 * text, and shows a success or failure toast. Drop-in for the row/button
 * `handleCopy(e, text)` pattern used across admin views.
 */
export function useCopyToClipboard() {
  const toast = useToastActions();

  return useCallback(
    async (e: React.MouseEvent, text: string) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Failed to copy to clipboard");
      }
    },
    [toast],
  );
}
