import * as React from "react";
import { Toaster } from "sonner";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  description: string;
  duration?: number;
}

export interface ToastContextType {
  addToast: (toast: Omit<Toast, "id">) => void;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          className:
            "!bg-card !border-border/60 !text-foreground !shadow-lg [&_[data-icon]]:!text-muted-foreground",
          classNames: {
            success: "[&_[data-icon]]:!text-emerald-400",
            error: "[&_[data-icon]]:!text-red-400",
            warning: "[&_[data-icon]]:!text-amber-400",
            info: "[&_[data-icon]]:!text-blue-400",
            description: "!text-muted-foreground",
          },
        }}
      />
    </>
  );
}
