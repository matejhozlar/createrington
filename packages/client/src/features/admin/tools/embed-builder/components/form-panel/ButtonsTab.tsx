import { useEffect, useRef } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  EmbedActionButton,
  EmbedLinkButton,
} from "@createrington/shared/api/embed";
import { MentionAutocomplete } from "../MentionAutocomplete";
import type { FocusTarget } from "../../focus";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPACT_BUTTON,
  SectionHead,
  EmptyState,
  Segmented,
  RowIconButton,
} from "../form-primitives";
import type { TabProps } from "./types";
import { useDragSensors } from "./use-drag-sensors";

type ButtonItem =
  | { kind: "link"; btn: EmbedLinkButton; idx: number }
  | { kind: "action"; btn: EmbedActionButton; idx: number };

export function ButtonsTab({ data, set, focused, setFocused }: TabProps) {
  const links = data.buttons ?? [];
  const actions = data.actionButtons ?? [];
  const total = links.length + actions.length;
  const sensors = useDragSensors();

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
    set({ buttons: links.filter((_, j) => j !== i) });
  }
  function removeAction(i: number) {
    set({ actionButtons: actions.filter((_, j) => j !== i) });
  }
  function addLink() {
    if (total >= 5) return;
    set({ buttons: [...links, { label: "", url: "" }] });
    setFocused?.(`button:link:${links.length}` as FocusTarget);
  }
  function addAction() {
    if (total >= 5) return;
    set({
      actionButtons: [
        ...actions,
        {
          label: "",
          action: "create_thread",
          channelId: "",
          threadName: "{username}'s thread",
          threadMessage: "Hey {user}, this thread was created for you!",
        },
      ],
    });
    setFocused?.(`button:action:${actions.length}` as FocusTarget);
  }
  function migrate(item: ButtonItem, target: "link" | "action") {
    if (item.kind === target) return;
    if (target === "link") {
      const promoted: EmbedLinkButton = {
        label: item.btn.label,
        url: "",
        emoji: item.btn.emoji,
      };
      set({
        actionButtons: actions.filter((_, j) => j !== item.idx),
        buttons: [...links, promoted],
      });
    } else {
      const promoted: EmbedActionButton = {
        label: item.btn.label,
        emoji: item.btn.emoji,
        action: "create_thread",
        channelId: "",
        threadName: "{username}'s thread",
        threadMessage: "Hey {user}!",
      };
      set({
        buttons: links.filter((_, j) => j !== item.idx),
        actionButtons: [...actions, promoted],
      });
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);
    if (a.startsWith("bl-") && o.startsWith("bl-")) {
      const from = Number(a.slice(3));
      const to = Number(o.slice(3));
      set({ buttons: arrayMove(links, from, to) });
    } else if (a.startsWith("ba-") && o.startsWith("ba-")) {
      const from = Number(a.slice(3));
      const to = Number(o.slice(3));
      set({ actionButtons: arrayMove(actions, from, to) });
    }
  }

  const linkIds = links.map((_, i) => `bl-${i}`);
  const actionIds = actions.map((_, i) => `ba-${i}`);

  return (
    <>
      <SectionHead
        title="Buttons"
        count={`${total}/5`}
        right={
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className={COMPACT_BUTTON}
              disabled={total >= 5}
              onClick={addLink}
            >
              <Plus className="mr-1 size-3" />
              Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={COMPACT_BUTTON}
              disabled={total >= 5}
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
          title="No buttons yet"
          hint={
            <>
              <strong className="text-foreground">Link</strong> buttons open
              URLs. <strong className="text-foreground">Action</strong> buttons
              run server logic, like opening a support thread.
            </>
          }
          actions={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={addLink}>
                Add link button
              </Button>
              <Button variant="outline" size="sm" onClick={addAction}>
                Add action button
              </Button>
            </div>
          }
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className="space-y-2">
          <SortableContext
            items={linkIds}
            strategy={verticalListSortingStrategy}
          >
            {links.map((b, i) => (
              <ButtonRow
                key={linkIds[i]}
                id={linkIds[i]}
                item={{ kind: "link", btn: b, idx: i }}
                focused={focused === `button:link:${i}`}
                onChangeLink={(u) => setLink(i, u)}
                onChangeAction={() => undefined}
                onRemove={() => removeLink(i)}
                onMigrate={(target) =>
                  migrate({ kind: "link", btn: b, idx: i }, target)
                }
              />
            ))}
          </SortableContext>
          <SortableContext
            items={actionIds}
            strategy={verticalListSortingStrategy}
          >
            {actions.map((b, i) => (
              <ButtonRow
                key={actionIds[i]}
                id={actionIds[i]}
                item={{ kind: "action", btn: b, idx: i }}
                focused={focused === `button:action:${i}`}
                onChangeLink={() => undefined}
                onChangeAction={(u) => setAction(i, u)}
                onRemove={() => removeAction(i)}
                onMigrate={(target) =>
                  migrate({ kind: "action", btn: b, idx: i }, target)
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
  onMigrate,
}: {
  id: string;
  item: ButtonItem;
  focused: boolean;
  onChangeLink: (updates: Partial<EmbedLinkButton>) => void;
  onChangeAction: (updates: Partial<EmbedActionButton>) => void;
  onRemove: () => void;
  onMigrate: (target: "link" | "action") => void;
}) {
  const labelRef = useRef<HTMLInputElement | null>(null);
  const emojiRef = useRef<HTMLInputElement | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  useEffect(() => {
    if (focused) labelRef.current?.focus();
  }, [focused]);

  const emoji = item.btn.emoji ?? "";
  const setEmoji = (next: string) =>
    item.kind === "link"
      ? onChangeLink({ emoji: next || undefined })
      : onChangeAction({ emoji: next || undefined });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex gap-1 rounded-md border border-border bg-card p-2 transition-shadow max-sm:flex-wrap",
        "hover:border-[var(--border-strong)] hover:shadow-sm",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        title="Drag to reorder"
        aria-label="Drag handle"
        {...attributes}
        {...listeners}
        className="mt-1 flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground touch-none active:cursor-grabbing max-sm:order-2 max-sm:mt-0 pointer-coarse:size-9"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1 space-y-1.5 max-sm:order-1 max-sm:basis-full">
        <div className="flex items-center gap-1.5 max-sm:flex-wrap">
          <Segmented
            value={item.kind}
            options={[
              { value: "link", label: "Link" },
              { value: "action", label: "Action" },
            ]}
            onChange={(v) => onMigrate(v as "link" | "action")}
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
              onChange={(e) =>
                onChangeAction({ threadMessage: e.target.value })
              }
              className="resize-y px-2.5 py-1.5 text-[13px] md:text-[13px]"
            />
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-0.5 max-sm:order-3 max-sm:ml-auto max-sm:flex-row">
        <RowIconButton title="Delete" onClick={onRemove} destructive>
          <Trash2 className="size-3.5" />
        </RowIconButton>
      </div>
    </div>
  );
}
