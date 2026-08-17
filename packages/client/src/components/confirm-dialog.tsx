import { useRef, useState, type MouseEvent, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => unknown;
  variant?: "default" | "destructive" | "success";
  confirmDisabled?: boolean;
  cancelLabel?: string;
  size?: "default" | "sm";
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "default",
  confirmDisabled = false,
  cancelLabel = "Cancel",
  size = "default",
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (!pendingRef.current) onOpenChange(isOpen);
  };

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (pendingRef.current) return;
    const result = onConfirm();
    if (result instanceof Promise) {
      pendingRef.current = true;
      setPending(true);
      const succeeded = await result.then(
        () => true,
        () => false,
      );
      pendingRef.current = false;
      setPending(false);
      if (succeeded) onOpenChange(false);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent size={size}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            className="relative"
            onClick={handleConfirm}
            disabled={confirmDisabled || pending}
          >
            <span className={cn(pending && "invisible")}>{confirmLabel}</span>
            {pending && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Spinner />
              </span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
