import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceField } from "@/components/choice-field";
import { FormDialog } from "@/components/form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useDialogDraft } from "@/hooks/use-dialog-draft";

type Config = RouterOutput["admin"]["autoMessages"]["configs"]["list"][number];
type ChannelGroup = RouterOutput["admin"]["autoMessages"]["channels"][number];
type RotationMode = Config["rotationMode"];

const ROTATION_MODE_OPTIONS: { value: RotationMode; label: string }[] = [
  { value: "sequential", label: "Sequential" },
  { value: "random", label: "Random" },
];

interface UpsertConfigDialogProps {
  open: boolean;
  onClose: () => void;
  config?: Config | null;
  channels: ChannelGroup[];
}

export function UpsertConfigDialog({
  open,
  onClose,
  config,
  channels,
}: UpsertConfigDialogProps) {
  const toast = useToastActions();
  const isEdit = !!config;

  const handleSaved = () => {
    void queryClient.invalidateQueries(
      trpc.admin.autoMessages.configs.pathFilter(),
    );
    onClose();
  };

  const createMutation = useMutation(
    trpc.admin.autoMessages.configs.create.mutationOptions(
      useMutationToast({ success: "Config created", onSuccess: handleSaved }),
    ),
  );
  const updateMutation = useMutation(
    trpc.admin.autoMessages.configs.update.mutationOptions(
      useMutationToast({ success: "Config updated", onSuccess: handleSaved }),
    ),
  );

  const [draft, update] = useDialogDraft<{
    name: string;
    channelId: string;
    intervalMinutes: number;
    rotationMode: RotationMode;
    enabled: boolean;
  }>(open, () => ({
    name: config?.name ?? "",
    channelId: config?.channelId ?? "",
    intervalMinutes: config?.intervalMinutes ?? 60,
    rotationMode: config?.rotationMode ?? "sequential",
    enabled: config?.enabled ?? false,
  }));
  const { name, channelId, intervalMinutes, rotationMode, enabled } = draft;

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!name.trim() || !channelId) {
      toast.error("Name and channel are required");
      return;
    }

    if (isEdit) {
      updateMutation.mutate({
        id: config.id,
        name: name.trim(),
        channelId,
        intervalMinutes,
        rotationMode,
        enabled,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        channelId,
        intervalMinutes,
        rotationMode,
        enabled,
      });
    }
  };

  const channelLabel = channels
    .flatMap((g) => g.channels.map((c) => ({ ...c, category: g.category })))
    .find((c) => c.id === channelId);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Config" : "New Auto-Message Config"}
      onConfirm={handleSubmit}
      confirmLabel={isEdit ? "Save" : "Create"}
      loading={isPending}
      contentClassName="sm:max-w-lg"
      asForm
    >
      <Field>
        <FieldLabel htmlFor="config-name">Name</FieldLabel>
        <Input
          id="config-name"
          value={name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Rails 'n Sails Tips"
          maxLength={100}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="auto-message-channel">Channel</FieldLabel>
        <Select
          value={channelId}
          onValueChange={(value: string) => update({ channelId: value })}
        >
          <SelectTrigger id="auto-message-channel" className="w-full">
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
        <FieldLabel htmlFor="config-interval">Interval (minutes)</FieldLabel>
        <Input
          id="config-interval"
          type="number"
          min={1}
          max={10080}
          value={intervalMinutes}
          onChange={(e) => update({ intervalMinutes: Number(e.target.value) })}
        />
        <FieldDescription>
          How often a message is sent (1 min – 7 days)
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Rotation Mode</FieldLabel>
        <ChoiceField
          value={rotationMode}
          options={ROTATION_MODE_OPTIONS}
          onChange={(value: RotationMode) => update({ rotationMode: value })}
        />
        <FieldDescription>
          Sequential cycles in order, random picks any message
        </FieldDescription>
      </Field>

      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => update({ enabled: checked === true })}
        />
        <span className="text-sm font-medium">Enabled</span>
      </label>
    </FormDialog>
  );
}
