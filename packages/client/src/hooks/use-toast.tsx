import { ToastContextType } from "@/components/ui/toast";
import * as React from "react";

// ============================================================================
// Context
// ============================================================================

export const ToastContext = React.createContext<ToastContextType | undefined>(
  undefined,
);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

/**
 * Convenience hook with pre-configured toast methods
 */
export function useToastActions() {
  const { addToast } = useToast();

  return React.useMemo(
    () => ({
      success: (description: string, title?: string) =>
        addToast({
          type: "success",
          title,
          description,
        }),
      error: (description: string, title?: string) =>
        addToast({
          type: "error",
          title,
          description,
        }),
      warning: (description: string, title?: string) =>
        addToast({
          type: "warning",
          title,
          description,
        }),
      info: (description: string, title?: string) =>
        addToast({
          type: "info",
          title,
          description,
        }),
    }),
    [addToast],
  );
}
