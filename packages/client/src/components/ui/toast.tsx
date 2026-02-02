import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastContext } from "@/hooks/use-toast";

// ============================================================================
// Types
// ============================================================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  description: string;
  duration?: number;
  icon?: React.ReactNode;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

// ============================================================================
// Provider
// ============================================================================

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = React.useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        ...toast,
        id,
        duration: toast.duration ?? 3000,
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto-remove after duration
      const duration = newToast.duration ?? 0;
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// ============================================================================
// Container
// ============================================================================

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-end justify-end gap-2 p-4 md:p-6"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// ============================================================================
// Toast Item
// ============================================================================

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = React.useState(false);

  const handleRemove = React.useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 200); // Match animation duration
  }, [toast.id, onRemove]);

  const typeStyles = {
    success: {
      bg: "bg-green-500/10 dark:bg-green-500/20",
      border: "border-green-500/50",
      text: "text-green-500",
      icon: "bg-green-500",
    },
    error: {
      bg: "bg-destructive/10 dark:bg-destructive/20",
      border: "border-destructive/50",
      text: "text-destructive",
      icon: "bg-destructive",
    },
    warning: {
      bg: "bg-yellow-500/10 dark:bg-yellow-500/20",
      border: "border-yellow-500/50",
      text: "text-yellow-500",
      icon: "bg-yellow-500",
    },
    info: {
      bg: "bg-sidebar-primary/10 dark:bg-sidebar-primary/20",
      border: "border-sidebar-primary/50",
      text: "text-sidebar-primary",
      icon: "bg-sidebar-primary",
    },
  };

  const style = typeStyles[toast.type];
  const duration = toast.duration ?? 0;

  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-200",
        style.bg,
        style.border,
        isExiting
          ? "animate-out slide-out-to-right-full fade-out"
          : "animate-in slide-in-from-right-full fade-in",
      )}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        {toast.icon && (
          <div
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full",
              style.icon,
            )}
          >
            <div className="text-white">{toast.icon}</div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 space-y-1">
          {toast.title && (
            <p className={cn("text-sm font-semibold", style.text)}>
              {toast.title}
            </p>
          )}
          <p className="text-sm text-foreground">{toast.description}</p>
        </div>

        {/* Close button */}
        <button
          onClick={handleRemove}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent",
            style.text,
          )}
          aria-label="Close notification"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-1 w-full overflow-hidden bg-sidebar-accent/30">
          <div
            className={cn("h-full", style.icon)}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}
