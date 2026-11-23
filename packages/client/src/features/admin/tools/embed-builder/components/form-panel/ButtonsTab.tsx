import { useEffect, useRef } from "react";
import { MousePointerClick, Plus, Trash2 } from "lucide-react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceField } from "@/components/choice-field";
import { EmptyState } from "@/components/query-states";
import {
  EMBED_MAX_BUTTONS,
  type EmbedActionButton,
  type EmbedLinkButton,
} from "@createrington/shared/api/embed";
import { MentionAutocomplete } from "@/features/admin/components/discord/MentionAutocomplete";
import {
  COMPACT_BUTTON,
  RowIconButton,
  SectionHead,
} from "@/features/admin/tools/embed-builder/components/form-primitives";
import { useDragSensors } from "@/features/admin/tools/embed-builder/hooks/use-drag-sensors";
import { useItemKeys } from "@/features/admin/tools/embed-builder/hooks/use-item-keys";
import { SortableRow } from "./SortableRow";
import type { TabProps } from "./types";

type ButtonKind = "link" | "action";

type ButtonItem =
  | { kind: "link"; btn: EmbedLinkButton }
  | { kind: "action"; btn: EmbedActionButton };

const KIND_OPTIONS = [
  { value: "link", label: "Link" },
  { value: "action", label: "Action" },
] as const;

function newActionButton(
  label = "",
  emoji?: string,
  threadMessage = "Hey {user}, this thread was created for you!",
): EmbedActionButton {
  return {
    label,
    emoji,
    action: "create_thread",
    channelId: "",
    threadName: "{username}'s thread",
    threadMessage,
  };
}

export function ButtonsTab({ data, set, focused, setFocused }: TabProps) {
  const links = data.buttons;
  const actions = data.actionButtons;
  const total = links.length + actions.length;
  const full = total >= EMBED_MAX_BUTTONS;
  const sensors = useDragSensors();
  const linkKeys = useItemKeys(links.length);
  const actionKeys = useItemKeys(actions.length);

  function setLink(i: number, updates: Partial<EmbedLinkButton>) {
    set({
      buttons: links.map((b, j) => (j === i ? { ...b, ...updates } : b)),
    });
  }
  function setAction(i: number, updates: Partial<EmbedActionButton>) {
    set({
      actionButtons: actions.map((b, j) =>
        j === i ? { ...b, ...updates } : b,
      ),
    });
  }
  function removeLink(i: number) {
    linkKeys.remove(i);
    set({ buttons: links.filter((_, j) => j !== i) });
  }
  function removeAction(i: number) {
    actionKeys.remove(i);
    set({ actionButtons: actions.filter((_, j) => j !== i) });
  }
  function addLink() {
    if (full) return;
    set({ buttons: [...links, { label: "", url: "" }] });
    setFocused?.(`button:link:${links.length}`);
  }
  function addAction() {
    if (full) return;
    set({ actionButtons: [...actions, newActionButton()] });
    setFocused?.(`button:action:${actions.length}`);
  }
  function convert(item: ButtonItem, index: number, target: ButtonKind) {
    if (item.kind === target) return;
    if (item.kind === "action") {
      actionKeys.remove(index);
      set({
        actionButtons: actions.filter((_, j) => j !== index),
        buttons: [
          ...links,
          { label: item.btn.label, url: "", emoji: item.btn.emoji },
        ],
      });
    } else {
      linkKeys.remove(index);
      set({
        buttons: links.filter((_, j) => j !== index),
        actionButtons: [
          ...actions,
          newActionButton(item.btn.label, item.btn.emoji, "Hey {user}!"),
        ],
      });
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const reorder = <T,>(keys: typeof linkKeys, list: T[]): T[] | null => {
      const from = keys.indexOf(active.id);
      const to = keys.indexOf(over.id);
      if (from < 0 || to < 0) return null;
      keys.reorder(from, to);
      return arrayMove(list, from, to);
    };
    const nextLinks = reorder(linkKeys, links);
    if (nextLinks) {
      set({ buttons: nextLinks });
      return;
    }
    const nextActions = reorder(actionKeys, actions);
    if (nextActions) set({ actionButtons: nextActions });
  }

  return (
    <>
      <SectionHead
        title="Buttons"
        count={`${total}/${EMBED_MAX_BUTTONS}`}
        right={
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className={COMPACT_BUTTON}
              disabled={full}
              onClick={addLink}
            >
              <Plus className="mr-1 size-3" />
              Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={COMPACT_BUTTON}
              disabled={full}
              onClick={addAction}
            >
              <Plus className="mr-1 size-3" />
              Action
            </Button>
          </div>
        }
      />

      {total === 0 && (
        <EmptyState
          icon={MousePointerClick}
          message="No buttons yet"
          hint={
            <>
              <strong className="text-foreground">Link</strong> buttons open
              URLs. <strong className="text-foreground">Action</strong> buttons
              run server logic, like opening a support thread.
            </>
          }
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={addLink}>
              Add link button
            </Button>
            <Button variant="outline" size="sm" onClick={addAction}>
              Add action button
            </Button>
          </div>
        </EmptyState>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className="space-y-2">
          <SortableContext
            items={linkKeys.keys}
            strategy={verticalListSortingStrategy}
          >
            {links.map((b, i) => (
              <ButtonRow
                key={linkKeys.keys[i]}
                id={linkKeys.keys[i]}
                item={{ kind: "link", btn: b }}
                focused={focused === `button:link:${i}`}
                onChangeLink={(u) => setLink(i, u)}
                onChangeAction={() => undefined}
                onRemove={() => removeLink(i)}
                onConvert={(target) =>
                  convert({ kind: "link", btn: b }, i, target)
                }
              />
            ))}
          </SortableContext>
          <SortableContext
            items={actionKeys.keys}
            strategy={verticalListSortingStrategy}
          >
            {actions.map((b, i) => (
              <ButtonRow
                key={actionKeys.keys[i]}
                id={actionKeys.keys[i]}
                item={{ kind: "action", btn: b }}
                focused={focused === `button:action:${i}`}
                onChangeLink={() => undefined}
                onChangeAction={(u) => setAction(i, u)}
                onRemove={() => removeAction(i)}
                onConvert={(target) =>
                  convert({ kind: "action", btn: b }, i, target)
                }
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </>
  );
}

function ButtonRow({
  id,
  item,
  focused,
  onChangeLink,
  onChangeAction,
  onRemove,
  onConvert,
}: {
  id: number;
  item: ButtonItem;
  focused: boolean;
  onChangeLink: (updates: Partial<EmbedLinkButton>) => void;
  onChangeAction: (updates: Partial<EmbedActionButton>) => void;
  onRemove: () => void;
  onConvert: (target: ButtonKind) => void;
}) {
  const labelRef = useRef<HTMLInputElement | null>(null);
  const emojiRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (focused) labelRef.current?.focus();
  }, [focused]);

  const emoji = item.btn.emoji ?? "";
  const setEmoji = (next: string) =>
    item.kind === "link"
      ? onChangeLink({ emoji: next || undefined })
      : onChangeAction({ emoji: next || undefined });

  return (
    <SortableRow
      id={id}
      actions={
        <RowIconButton
          icon={Trash2}
          label="Delete"
          onClick={onRemove}
          destructive
        />
      }
    >
      <div className="flex items-center gap-1.5 max-sm:flex-wrap">
        <ChoiceField
          value={item.kind}
          options={KIND_OPTIONS}
          onChange={onConvert}
        />
        <div className="relative max-sm:min-w-0 max-sm:flex-1">
          <Input
            ref={emojiRef}
            value={emoji}
            placeholder="🔗"
            maxLength={64}
            title="A unicode emoji, or type : to pick a bot emoji"
            onChange={(e) => setEmoji(e.target.value)}
            className="h-8 w-16 text-center text-[13px] max-sm:w-full"
          />
          <MentionAutocomplete
            inputRef={emojiRef}
            value={emoji}
            onChange={setEmoji}
            emojiOnly
          />
        </div>
        <Input
          ref={labelRef}
          value={item.btn.label}
          placeholder="Label"
          maxLength={80}
          onChange={(e) =>
            item.kind === "link"
              ? onChangeLink({ label: e.target.value })
              : onChangeAction({ label: e.target.value })
          }
          className="h-8 flex-1 text-[13px] max-sm:basis-full"
        />
      </div>

      {item.kind === "link" ? (
        <Input
          value={item.btn.url}
          placeholder="https://..."
          onChange={(e) => onChangeLink({ url: e.target.value })}
          className="h-8 text-[13px]"
        />
      ) : (
        <div className="space-y-1.5">
          <Input
            value={item.btn.channelId}
            placeholder="Channel ID"
            onChange={(e) => onChangeAction({ channelId: e.target.value })}
            className="h-8 text-[13px]"
          />
          <Input
            value={item.btn.threadName}
            placeholder="{username}'s ticket"
            maxLength={100}
            onChange={(e) => onChangeAction({ threadName: e.target.value })}
            className="h-8 text-[13px]"
          />
          <Textarea
            value={item.btn.threadMessage}
            placeholder="Welcome message"
            rows={2}
            maxLength={2000}
            onChange={(e) => onChangeAction({ threadMessage: e.target.value })}
            className="resize-y px-2.5 py-1.5 text-[13px] md:text-[13px]"
          />
        </div>
      )}
    </SortableRow>
  );
}
