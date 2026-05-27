import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AdminActionModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onConfirm: () => void;
  confirmLabel: string;
  loadingLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  contentClassName?: string;
  asForm?: boolean;
}

export function AdminActionModal({
  open,
  onClose,
  title,
  description,
  children,
  onConfirm,
  confirmLabel,
  loadingLabel,
  cancelLabel = "Cancel",
  loading = false,
  disabled = false,
  destructive = false,
  contentClassName,
  asForm = false,
}: AdminActionModalProps) {
  const fields = <div className="space-y-4">{children}</div>;
  const footer = (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        className="flex-1"
        onClick={onClose}
        disabled={loading}
      >
        {cancelLabel}
      </Button>
      <Button
        type={asForm ? "submit" : "button"}
        variant={destructive ? "destructive" : "default"}
        className="flex-1"
        onClick={asForm ? undefined : onConfirm}
        disabled={disabled || loading}
      >
        {loading ? loadingLabel : confirmLabel}
      </Button>
    </DialogFooter>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "sm:max-w-md",
          destructive && "border-destructive",
          contentClassName,
        )}
      >
        <DialogHeader>
          <DialogTitle className={destructive ? "text-destructive" : undefined}>
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {asForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!disabled && !loading) onConfirm();
            }}
          >
            {fields}
            {footer}
          </form>
        ) : (
          <>
            {fields}
            {footer}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
