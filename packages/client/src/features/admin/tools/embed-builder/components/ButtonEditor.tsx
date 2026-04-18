import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2 } from "lucide-react";
import { ChannelSelector } from "./ChannelSelector";
import type {
  EmbedLinkButton,
  EmbedActionButton,
} from "@createrington/shared/api/embed";

type AnyButton =
  | ({ _type: "link" } & EmbedLinkButton)
  | ({ _type: "action" } & EmbedActionButton);

interface ButtonEditorProps {
  buttons: EmbedLinkButton[];
  actionButtons: EmbedActionButton[];
  onChangeButtons: (buttons: EmbedLinkButton[]) => void;
  onChangeActionButtons: (buttons: EmbedActionButton[]) => void;
}

export function ButtonEditor({
  buttons,
  actionButtons,
  onChangeButtons,
  onChangeActionButtons,
}: ButtonEditorProps) {
  const totalButtons = buttons.length + actionButtons.length;

  const allButtons: AnyButton[] = [
    ...buttons.map((b) => ({ _type: "link" as const, ...b })),
    ...actionButtons.map((b) => ({ _type: "action" as const, ...b })),
  ];

  function addLinkButton() {
    if (totalButtons >= 5) return;
    onChangeButtons([...buttons, { label: "", url: "" }]);
  }

  function addActionButton() {
    if (totalButtons >= 5) return;
    onChangeActionButtons([
      ...actionButtons,
      {
        label: "",
        action: "create_thread",
        channelId: "",
        threadName: "{username}'s Thread",
        threadMessage: "Hey {user}, this thread was created for you!",
      },
    ]);
  }

  function removeButton(btn: AnyButton, indexInType: number) {
    if (btn._type === "link") {
      onChangeButtons(buttons.filter((_, i) => i !== indexInType));
    } else {
      onChangeActionButtons(actionButtons.filter((_, i) => i !== indexInType));
    }
  }

  function updateLinkButton(index: number, updates: Partial<EmbedLinkButton>) {
    onChangeButtons(
      buttons.map((b, i) => (i === index ? { ...b, ...updates } : b)),
    );
  }

  function updateActionButton(
    index: number,
    updates: Partial<EmbedActionButton>,
  ) {
    onChangeActionButtons(
      actionButtons.map((b, i) => (i === index ? { ...b, ...updates } : b)),
    );
  }

  // Track per-type index for each button in the unified list
  let linkIdx = 0;
  let actionIdx = 0;
  const indexedButtons = allButtons.map((btn) => {
    if (btn._type === "link") {
      return { btn, typeIndex: linkIdx++ };
    }
    return { btn, typeIndex: actionIdx++ };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Buttons ({totalButtons}/5)</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLinkButton}
            disabled={totalButtons >= 5}
          >
            <Plus className="mr-1 size-3.5" />
            Link
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addActionButton}
            disabled={totalButtons >= 5}
          >
            <Plus className="mr-1 size-3.5" />
            Action
          </Button>
        </div>
      </div>

      {totalButtons === 0 && (
        <p className="text-xs text-muted-foreground">No buttons added yet.</p>
      )}

      <div className="space-y-3">
        {indexedButtons.map(({ btn, typeIndex }, i) => (
          <div
            key={`${btn._type}-${typeIndex}`}
            className="space-y-2 rounded-md border border-border bg-sidebar/50 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Button {i + 1}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    btn._type === "link"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {btn._type === "link" ? "Link" : "Create Thread"}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeButton(btn, typeIndex)}
                    className="size-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Remove button</TooltipContent>
              </Tooltip>
            </div>

            {/* Common: Label + Emoji */}
            <Input
              placeholder="Button label"
              value={btn.label}
              onChange={(e) =>
                btn._type === "link"
                  ? updateLinkButton(typeIndex, { label: e.target.value })
                  : updateActionButton(typeIndex, { label: e.target.value })
              }
              maxLength={80}
            />
            <Input
              placeholder="Emoji (optional, e.g. 🔗)"
              value={btn.emoji ?? ""}
              onChange={(e) =>
                btn._type === "link"
                  ? updateLinkButton(typeIndex, {
                      emoji: e.target.value || undefined,
                    })
                  : updateActionButton(typeIndex, {
                      emoji: e.target.value || undefined,
                    })
              }
              maxLength={32}
            />

            {/* Link-specific fields */}
            {btn._type === "link" && (
              <Input
                placeholder="https://..."
                value={btn.url}
                onChange={(e) =>
                  updateLinkButton(typeIndex, { url: e.target.value })
                }
              />
            )}

            {/* Action-specific fields */}
            {btn._type === "action" && (
              <>
                <ChannelSelector
                  value={btn.channelId}
                  onChange={(v) =>
                    updateActionButton(typeIndex, { channelId: v })
                  }
                />
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    Thread Name{" "}
                    <span className="text-[10px] text-muted-foreground/60">
                      {"{user} {username} {date}"}
                    </span>
                  </span>
                  <Input
                    placeholder="{username}'s Thread"
                    value={btn.threadName}
                    onChange={(e) =>
                      updateActionButton(typeIndex, {
                        threadName: e.target.value,
                      })
                    }
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    Thread Message{" "}
                    <span className="text-[10px] text-muted-foreground/60">
                      {"{user} {username} {date}"}
                    </span>
                  </span>
                  <textarea
                    placeholder="Hey {user}, this thread was created for you!"
                    value={btn.threadMessage}
                    onChange={(e) =>
                      updateActionButton(typeIndex, {
                        threadMessage: e.target.value,
                      })
                    }
                    rows={3}
                    maxLength={2000}
                    className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
