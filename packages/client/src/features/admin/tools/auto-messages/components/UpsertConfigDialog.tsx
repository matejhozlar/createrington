import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Config = RouterOutput["admin"]["autoMessages"]["configs"]["list"][number];
type ChannelGroup = RouterOutput["admin"]["autoMessages"]["channels"][number];

interface UpsertConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  config?: Config | null;
  channels: ChannelGroup[];
}

export function UpsertConfigDialog({
  open,
  onClose,
  onSuccess,
  config,
  channels,
}: UpsertConfigDialogProps) {
  const toast = useToastActions();
  const isEdit = !!config;

  const createMutation = trpc.admin.autoMessages.configs.create.useMutation();
  const updateMutation = trpc.admin.autoMessages.configs.update.useMutation();

  const [name, setName] = useState(config?.name ?? "");
  const [channelId, setChannelId] = useState(config?.channelId ?? "");
  const [intervalMinutes, setIntervalMinutes] = useState(
    config?.intervalMinutes ?? 60,
  );
  const [rotationMode, setRotationMode] = useState<"sequential" | "random">(
    config?.rotationMode ?? "sequential",
  );
  const [enabled, setEnabled] = useState(config?.enabled ?? false);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !channelId) {
      toast.error("Name and channel are required");
      return;
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: config.id,
          name: name.trim(),
          channelId,
          intervalMinutes,
          rotationMode,
          enabled,
        });
        toast.success("Config updated");
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          channelId,
          intervalMinutes,
          rotationMode,
          enabled,
        });
        toast.success("Config created");
      }
      onSuccess();
    } catch {
      toast.error(`Failed to ${isEdit ? "update" : "create"} config`);
    }
  };

  const channelLabel = channels
    .flatMap((g) => g.channels.map((c) => ({ ...c, category: g.category })))
    .find((c) => c.id === channelId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Config" : "New Auto-Message Config"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="config-name">Name</FieldLabel>
            <Input
              id="config-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cogs & Steam Tips"
              maxLength={100}
            />
          </Field>

          <Field>
            <FieldLabel>Channel</FieldLabel>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a channel">
                  {channelLabel
                    ? `#${channelLabel.name} (${channelLabel.category})`
                    : "Select a channel"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {channels.map((group) => (
                  <div key={group.categoryId}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {group.category}
                    </div>
                    {group.channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        #{channel.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="config-interval">
              Interval (minutes)
            </FieldLabel>
            <Input
              id="config-interval"
              type="number"
              min={1}
              max={10080}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            />
            <FieldDescription>
              How often a message is sent (1 min – 7 days)
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Rotation Mode</FieldLabel>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={rotationMode === "sequential" ? "default" : "outline"}
                onClick={() => setRotationMode("sequential")}
              >
                Sequential
              </Button>
              <Button
                type="button"
                size="sm"
                variant={rotationMode === "random" ? "default" : "outline"}
                onClick={() => setRotationMode("random")}
              >
                Random
              </Button>
            </div>
            <FieldDescription>
              Sequential cycles in order, random picks any message
            </FieldDescription>
          </Field>

          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
            />
            <span className="text-sm font-medium">Enabled</span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
