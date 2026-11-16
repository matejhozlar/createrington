import { useMemo } from "react";
import { toast } from "sonner";

/**
 * Convenience hook with pre-configured toast methods.
 * Powered by sonner, no provider context needed.
 */
export function useToastActions() {
  return useMemo(
    () => ({
      success: (description: string, title?: string) =>
        toast.success(title ?? description, {
          description: title ? description : undefined,
        }),
      error: (description: string, title?: string) =>
        toast.error(title ?? description, {
          description: title ? description : undefined,
        }),
      warning: (description: string, title?: string) =>
        toast.warning(title ?? description, {
          description: title ? description : undefined,
        }),
      info: (description: string, title?: string) =>
        toast.info(title ?? description, {
          description: title ? description : undefined,
        }),
    }),
    [],
  );
}
