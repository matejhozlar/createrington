import { Pencil, Trash2 } from "lucide-react";
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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{pack.name}</h1>
        {pack.isActive && (
          <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
            Active
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
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
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
