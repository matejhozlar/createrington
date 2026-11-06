import { ConfirmDialog } from "@/components/confirm-dialog";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";

type Exemption =
  RouterOutput["admin"]["inactivity"]["exemptions"]["list"]["exemptions"][number];

interface RemoveExemptionModalProps {
  exemption: Exemption | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RemoveExemptionModal({
  exemption,
  onClose,
  onSuccess,
}: RemoveExemptionModalProps) {
  const removeExemption = useMutation(
    trpc.admin.inactivity.exemptions.remove.mutationOptions(
      useMutationToast({ success: "Exemption removed", onSuccess }),
    ),
  );

  return (
    <ConfirmDialog
      open={exemption !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Remove Inactivity Exemption"
      description={
        exemption && (
          <>
            Stop exempting{" "}
            <span className="font-semibold">
              &quot;{exemption.minecraftUsername}&quot;
            </span>
            ? The next cleanup cycle will consider them for inactivity warnings
            again.
          </>
        )
      }
      confirmLabel="Remove"
      variant="destructive"
      onConfirm={() =>
        exemption
          ? removeExemption.mutateAsync({
              minecraftUuid: exemption.playerMinecraftUuid,
            })
          : undefined
      }
    />
  );
}
