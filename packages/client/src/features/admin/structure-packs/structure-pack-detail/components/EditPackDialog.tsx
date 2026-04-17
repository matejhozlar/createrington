import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

/**
 * Edit form for pack name and description.
 *
 * Mount this conditionally (`{editing && <EditPackDialog .../>}`) so the form
 * state resets automatically every time the dialog is opened. Initial values
 * are captured via `useState` on mount.
 */
export function EditPackDialog({
  onClose,
  packId,
  initialName,
  initialDescription,
}: {
  onClose: () => void;
  packId: number;
  initialName: string;
  initialDescription: string;
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  const updateMutation = trpc.admin.structurePacks.update.useMutation({
    onSuccess: () => {
      toast.success("Pack updated");
      utils.admin.structurePacks.get.invalidate({ id: packId });
      utils.admin.structurePacks.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pack</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              updateMutation.mutate({
                id: packId,
                name,
                description: description || undefined,
              })
            }
            disabled={!name.trim() || updateMutation.isPending}
          >
            <Save className="mr-1 size-3" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
