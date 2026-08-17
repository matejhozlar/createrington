import { Pencil, Trash2 } from "lucide-react";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  return (
    <AdminPageTitle
      title={pack.name}
      badges={
        pack.isActive && (
          <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
            Active
          </Badge>
        )
      }
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete &quot;{pack.name}&quot;?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the pack from the rotation pool. Historical
                    data will be preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </>
      }
    />
  );
}
