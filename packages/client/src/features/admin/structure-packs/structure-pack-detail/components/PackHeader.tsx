import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Pack {
  id: number;
  name: string;
  isActive: boolean;
  enabled: boolean;
}

export function PackHeader({
  pack,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  pack: Pack;
  onEdit: () => void;
  onDelete: () => Promise<unknown>;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <AdminPageTitle
      title={pack.name}
      badges={pack.isActive && <Badge tone="success">Active</Badge>}
      actions={
        <>
          <div className="flex h-9 items-center gap-2">
            <Checkbox
              id="enabled"
              checked={pack.enabled}
              disabled={pack.isActive}
              onCheckedChange={(checked) => onToggleEnabled(checked === true)}
            />
            <Label htmlFor="enabled" className="cursor-pointer text-sm">
              Enabled
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
          {!pack.isActive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={<>Delete &quot;{pack.name}&quot;?</>}
            description="This will remove the pack from the rotation pool. Historical data will be preserved."
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={onDelete}
          />
        </>
      }
    />
  );
}
