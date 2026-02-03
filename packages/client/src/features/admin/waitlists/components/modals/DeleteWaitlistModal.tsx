import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { X } from "lucide-react";
import { useToastActions } from "@/hooks/use-toast";
import type { WaitlistEntryApiData } from "@createrington/shared/db";

interface DeleteWaitlistModalProps {
  open: boolean;
  onClose: () => void;
  entry: Omit<WaitlistEntryApiData, "submittedAt" | "acceptedAt"> & {
    submittedAt: string;
    acceptedAt: string | null;
  };
  onSuccess: () => void;
}

export function DeleteWaitlistModal({
  open,
  onClose,
  entry,
  onSuccess,
}: DeleteWaitlistModalProps) {
  const toast = useToastActions();

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required for deletion");
      return;
    }

    const confirmText = prompt(
      'Type "DELETE" to confirm permanent deletion of this waitlist entry:',
    );
    if (confirmText !== "DELETE") return;

    try {
      setLoading(true);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(`/api/admin/waitlists/${entry.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      toast.success("Waitlist entry deleted successfully!");
      onSuccess();
    } catch (err) {
      console.error("Failed to delete waitlist entry:", err);
      toast.error("Failed to delete waitlist entry");
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-destructive bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-destructive">
            Delete Waitlist Entry
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
          This will permanently delete the waitlist entry for{" "}
          <span className="font-semibold">{entry.email}</span> (
          {entry.discordName}). This action cannot be undone.
        </p>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry ID:</span>
                <span className="font-medium">#{entry.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{entry.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discord:</span>
                <span className="font-medium">{entry.discordName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">{entry.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted:</span>
                <span className="font-medium">
                  {new Date(entry.submittedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="delete-reason">Reason for Deletion</FieldLabel>
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
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 cursor-pointer"
              onClick={handleSubmit}
              disabled={!reason.trim() || loading}
            >
              {loading ? "Deleting..." : "Delete Entry"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
