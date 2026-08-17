import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import {
  MAX_ENTRIES_PER_PLAYER,
  MIN_ENTRIES_PER_PLAYER,
  type PlayerPromptEntryModeValue,
} from "@createrington/shared/player-prompt";
import {
  COOLDOWN_OPTIONS,
  DURATION_OPTIONS,
  ENTRY_MODE_OPTIONS,
} from "../format";

// Format a camelCase config key ("serverAnnouncements") into the label
// we show in a picker ("Server Announcements"). Same transform the
// embed-builder pickers use, mirrored here to avoid cross-feature
// imports from a modal primitive.
function formatName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Sentinel select values: Radix Select can't hold an empty string, so
// reserved tokens stand in for "nothing selected" (no role ping, no
// cooldown) and "fall back to the server default (announcements)", and
// are translated back at submit.
const NONE = "__none__";
const DEFAULT_CHANNEL = "__default__";

export function CreatePromptModal({ open, onClose, onSuccess }: Props) {
  const toast = useToastActions();
  const createMutation = trpc.admin.prompts.create.useMutation();

  // Reuse the embed-builder endpoints: they already walk config.discord
  // and expose channels grouped by category plus a flat role list.
  const channelsQuery = trpc.admin.embeds.channels.useQuery();
  const rolesQuery = trpc.admin.embeds.roles.useQuery();

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [durationPreset, setDurationPreset] = useState<string>("24h");
  const [rolePingId, setRolePingId] = useState<string>(NONE);
  const [channelId, setChannelId] = useState<string>(DEFAULT_CHANNEL);
  const [entryMode, setEntryMode] =
    useState<PlayerPromptEntryModeValue>("single");
  const [maxEntries, setMaxEntries] = useState("");
  const [cooldownPreset, setCooldownPreset] = useState<string>(NONE);

  const isMulti = entryMode === "multi";
  const modeDescription = ENTRY_MODE_OPTIONS.find(
    (option) => option.value === entryMode,
  )?.description;

  const reset = () => {
    setQuestion("");
    setDescription("");
    setDurationPreset("24h");
    setRolePingId(NONE);
    setChannelId(DEFAULT_CHANNEL);
    setEntryMode("single");
    setMaxEntries("");
    setCooldownPreset(NONE);
  };

  const handleClose = () => {
    if (createMutation.isPending) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast.error("Question is required");
      return;
    }
    const durationMs = DURATION_OPTIONS.find(
      (option) => option.value === durationPreset,
    )?.ms;
    if (!durationMs) {
      toast.error("Select a valid duration");
      return;
    }

    const trimmedMaxEntries = maxEntries.trim();
    let maxEntriesValue: number | undefined;
    if (isMulti && trimmedMaxEntries) {
      maxEntriesValue = Number(trimmedMaxEntries);
      if (
        !Number.isInteger(maxEntriesValue) ||
        maxEntriesValue < MIN_ENTRIES_PER_PLAYER ||
        maxEntriesValue > MAX_ENTRIES_PER_PLAYER
      ) {
        toast.error(
          `Max entries must be between ${MIN_ENTRIES_PER_PLAYER} and ${MAX_ENTRIES_PER_PLAYER}`,
        );
        return;
      }
    }

    const cooldownSeconds = isMulti
      ? COOLDOWN_OPTIONS.find((option) => option.value === cooldownPreset)
          ?.seconds
      : undefined;

    try {
      await createMutation.mutateAsync({
        question: trimmedQuestion,
        description: description.trim() || undefined,
        durationMs,
        rolePingId: rolePingId === NONE ? undefined : rolePingId,
        channelId: channelId === DEFAULT_CHANNEL ? undefined : channelId,
        entryMode,
        maxEntries: maxEntriesValue,
        cooldownSeconds,
      });
      toast.success("Prompt posted to Discord");
      reset();
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Player Prompt</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="prompt-question">Question</FieldLabel>
            <Input
              id="prompt-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What should we focus on next month?"
              maxLength={256}
              autoFocus
              required
            />
            <FieldDescription>
              Shown as the heading of the Discord card.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="prompt-description">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <textarea
              id="prompt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context or examples to help players answer."
              rows={3}
              maxLength={2000}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="prompt-duration">
              Responses open for
            </FieldLabel>
            <Select value={durationPreset} onValueChange={setDurationPreset}>
              <SelectTrigger id="prompt-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="prompt-entry-mode">Entry mode</FieldLabel>
            <Select
              value={entryMode}
              onValueChange={(v) =>
                setEntryMode(v as PlayerPromptEntryModeValue)
              }
            >
              <SelectTrigger id="prompt-entry-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{modeDescription}</FieldDescription>
          </Field>

          {isMulti && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="prompt-max-entries">
                  Max entries
                </FieldLabel>
                <Input
                  id="prompt-max-entries"
                  type="number"
                  inputMode="numeric"
                  min={MIN_ENTRIES_PER_PLAYER}
                  max={MAX_ENTRIES_PER_PLAYER}
                  value={maxEntries}
                  onChange={(e) => setMaxEntries(e.target.value)}
                  placeholder="Unlimited"
                />
                <FieldDescription>
                  Per player. Leave empty for unlimited.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="prompt-cooldown">Cooldown</FieldLabel>
                <Select
                  value={cooldownPreset}
                  onValueChange={setCooldownPreset}
                >
                  <SelectTrigger id="prompt-cooldown">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No cooldown</SelectItem>
                    {COOLDOWN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Wait between a player's entries.
                </FieldDescription>
              </Field>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="prompt-channel">Channel</FieldLabel>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger id="prompt-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_CHANNEL}>
                  Announcements (default)
                </SelectItem>
                {(channelsQuery.data ?? [])
                  .filter((group) => group.channels.length > 0)
                  .map((group) => (
                    <SelectGroup key={group.category}>
                      <SelectLabel>{formatName(group.category)}</SelectLabel>
                      {group.channels.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          # {formatName(ch.name)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="prompt-role">
              Role to ping{" "}
              <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Select value={rolePingId} onValueChange={setRolePingId}>
              <SelectTrigger id="prompt-role">
                <SelectValue placeholder="No ping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No ping</SelectItem>
                {(rolesQuery.data ?? []).map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    @ {formatName(role.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              The mention is posted above the card inside Discord spoiler tags,
              so the channel stays visually clean while the ping still fires.
            </FieldDescription>
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Post to Discord
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
