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
        richColors
        toastOptions={{ duration: 3000 }}
      />
    </>
  );
}
