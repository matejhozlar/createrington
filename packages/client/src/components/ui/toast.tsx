import * as React from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
    }, 300); // Match animation duration
  }, [toast.id, onRemove]);

  const icons = {
    success: <CheckCircle2 className="text-green-500" />,
    error: <AlertCircle className="text-destructive" />,
    warning: <AlertTriangle className="text-yellow-500" />,
    info: <Info className="text-sidebar-primary" />,
  };

  const textColors = {
    success: "text-green-500",
    error: "text-destructive",
    warning: "text-yellow-500",
    info: "text-sidebar-primary",
  };

  const progressColors = {
    success: "bg-green-500",
    error: "bg-destructive",
    warning: "bg-yellow-500",
    info: "bg-primary",
  };

  const variant = toast.type === "error" ? "destructive" : "default";
  const duration = toast.duration ?? 0;

  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-sm transition-all duration-300 ease-in-out",
        isExiting
          ? "translate-x-[calc(100%+1.5rem)] opacity-0"
          : "translate-x-0 opacity-100",
      )}
      role="alert"
    >
      <Alert variant={variant} className="relative overflow-hidden shadow-lg">
        {icons[toast.type]}

        {toast.title && (
          <AlertTitle className={cn(textColors[toast.type])}>
            {toast.title}
          </AlertTitle>
        )}

        <AlertDescription className={toast.title ? "" : "mt-0"}>
          {toast.description}
        </AlertDescription>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className="absolute right-2 top-2 size-6 cursor-pointer"
          aria-label="Close notification"
        >
          <X className="size-3.5" />
        </Button>

        {/* Progress bar - countdown from right to left */}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-border/30">
            <div
              className={cn("h-full ml-auto", progressColors[toast.type])}
              style={{
                width: "100%",
                animation: `toast-countdown ${duration}ms linear forwards`,
              }}
            />
          </div>
        )}
      </Alert>
    </div>
  );
}
