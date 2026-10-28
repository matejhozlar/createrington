import {
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  confirmToken?: string;
  cancelLabel?: string;
  size?: "default" | "sm";
  children?: ReactNode;
}

interface ConfirmDialogActionsProps {
  confirmLabel: ReactNode;
  cancelLabel: string;
  variant: NonNullable<ConfirmDialogProps["variant"]>;
  confirmDisabled: boolean;
  confirmToken?: string;
  pending: boolean;
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => void;
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
  confirmToken,
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
        <ConfirmDialogActions
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          variant={variant}
          confirmDisabled={confirmDisabled}
          confirmToken={confirmToken}
          pending={pending}
          onConfirm={handleConfirm}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmDialogActions({
  confirmLabel,
  cancelLabel,
  variant,
  confirmDisabled,
  confirmToken,
  pending,
  onConfirm,
}: ConfirmDialogActionsProps) {
  const tokenInputId = useId();
  const [typedToken, setTypedToken] = useState("");
  const tokenMismatch =
    confirmToken !== undefined && typedToken !== confirmToken;

  return (
    <>
      {confirmToken !== undefined && (
        <Field>
          <FieldLabel htmlFor={tokenInputId}>
            Type <span className="font-mono font-semibold">{confirmToken}</span>{" "}
            to confirm
          </FieldLabel>
          <Input
            id={tokenInputId}
            type="text"
            autoComplete="off"
            placeholder={confirmToken}
            value={typedToken}
            onChange={(e) => setTypedToken(e.target.value)}
            disabled={pending}
          />
        </Field>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          variant={variant}
          className="relative"
          onClick={onConfirm}
          disabled={confirmDisabled || tokenMismatch || pending}
        >
          <span className={cn(pending && "invisible")}>{confirmLabel}</span>
          {pending && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </span>
          )}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
