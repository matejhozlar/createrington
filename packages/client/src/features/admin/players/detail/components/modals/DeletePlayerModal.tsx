import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { X } from "lucide-react";
import type { PlayerApiData } from "@createrington/shared/db";

interface DeletePlayerModalProps {
  open: boolean;
  onClose: () => void;
  player: PlayerApiData;
  onSuccess: () => void;
}

export function DeletePlayerModal({
  open,
  onClose,
  player,
  onSuccess,
}: DeletePlayerModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason) return;

    const confirmText = prompt(
      'Type "DELETE" to confirm permanent deletion of this player:',
    );
    if (confirmText !== "DELETE") return;

    try {
      setLoading(true);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(
        `/api/admin/players/${player.minecraftUuid}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      alert("Player deleted successfully!");
      onSuccess();
    } catch (err) {
      console.error("Failed to delete player:", err);
      alert("Failed to delete player");
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-destructive bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-destructive">
            Delete Player
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          This will permanently delete all player data including balance,
          sessions, tickets, and strikes. This action cannot be undone.
        </p>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="delete-reason">Reason</FieldLabel>
            <Input
              id="delete-reason"
              type="text"
              placeholder="Enter reason for deletion"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 cursor-pointer"
              onClick={handleSubmit}
              disabled={!reason || loading}
            >
              {loading ? "Deleting..." : "Delete Player"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
