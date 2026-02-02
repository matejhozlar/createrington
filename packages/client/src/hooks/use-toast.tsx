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
          icon: (
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ),
        }),
      error: (description: string, title?: string) =>
        addToast({
          type: "error",
          title,
          description,
          icon: (
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ),
        }),
      warning: (description: string, title?: string) =>
        addToast({
          type: "warning",
          title,
          description,
          icon: (
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ),
        }),
      info: (description: string, title?: string) =>
        addToast({
          type: "info",
          title,
          description,
          icon: (
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        }),
    }),
    [addToast],
  );
}
