import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
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
import type { EmbedField } from "@createrington/shared/api/embed";
import {
  AIButton,
  COMPACT_BUTTON,
  SectionHead,
  EmptyState,
  RowIconButton,
} from "../form-primitives";
import { InsertMenu } from "@/features/admin/components/InsertMenu";
import type { FocusTarget } from "../../focus";
import { Textarea } from "@/components/ui/textarea";
import type { TabProps } from "./types";
import { useDragSensors } from "./use-drag-sensors";

export function FieldsTab({ data, set, focused, setFocused }: TabProps) {
  const fields = data.fields;
  const sensors = useDragSensors();

  function update(i: number, updates: Partial<EmbedField>) {
    set({
      fields: fields.map((f, j) => (j === i ? { ...f, ...updates } : f)),
    });
  }
  function remove(i: number) {
    set({ fields: fields.filter((_, j) => j !== i) });
  }
  function add() {
    if (fields.length >= 25) return;
    set({ fields: [...fields, { name: "", value: "", inline: false }] });
    setFocused?.(`field:${fields.length}` as FocusTarget);
  }
  function move(i: number, dir: -1 | 1) {
    const next = [...fields];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ fields: next });
  }
  function duplicate(i: number) {
    if (fields.length >= 25) return;
    const next = [...fields];
    next.splice(i + 1, 0, { ...fields[i] });
    set({ fields: next });
  }
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = Number(String(active.id).slice(2));
    const to = Number(String(over.id).slice(2));
    if (Number.isNaN(from) || Number.isNaN(to)) return;
    set({ fields: arrayMove(fields, from, to) });
  }

  const ids = fields.map((_, i) => `f-${i}`);

  return (
    <>
      <SectionHead
        title="Fields"
        count={`${fields.length}/25`}
        right={
          <Button
            variant="outline"
            size="sm"
            className={COMPACT_BUTTON}
            disabled={fields.length >= 25}
            onClick={add}
          >
            <Plus className="mr-1 size-3" />
            Add field
          </Button>
        }
      />

      {fields.length === 0 && (
        <EmptyState
          title="No fields yet"
          hint="Fields are name/value rows shown below the description. Use them for structured info like server stats, links, or rules."
          actions={
            <Button variant="outline" size="sm" onClick={add}>
              <Plus className="mr-1 size-3.5" />
              Add your first field
            </Button>
          }
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <FieldRow
                key={ids[i]}
                id={ids[i]}
                field={f}
                index={i}
                count={fields.length}
                focused={focused === `field:${i}`}
                onChange={(u) => update(i, u)}
                onRemove={() => remove(i)}
                onMove={(d) => move(i, d)}
                onDuplicate={() => duplicate(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

function FieldRow({
  id,
  field,
  index,
  count,
  focused,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
}: {
  id: string;
  field: EmbedField;
  index: number;
  count: number;
  focused: boolean;
  onChange: (updates: Partial<EmbedField>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef<HTMLTextAreaElement | null>(null);
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
    if (focused) nameRef.current?.focus();
  }, [focused]);

  function insertIntoValue(text: string) {
    const el = valueRef.current;
    const pos = el?.selectionStart ?? field.value.length;
    const next = field.value.slice(0, pos) + text + field.value.slice(pos);
    onChange({ value: next });
    requestAnimationFrame(() => {
      if (el) {
        const after = pos + text.length;
        el.selectionStart = el.selectionEnd = after;
        el.focus();
      }
    });
  }

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
        <div className="flex items-center gap-1.5">
          <Input
            ref={nameRef}
            value={field.name}
            placeholder={`Field ${index + 1} name`}
            maxLength={256}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-8 flex-1 text-[13px]"
          />
          <label
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium transition-colors pointer-coarse:px-3 pointer-coarse:py-2 pointer-coarse:text-xs",
              field.inline
                ? "border-[var(--border-strong)] bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Render this field side-by-side with neighbors"
          >
            <input
              type="checkbox"
              checked={field.inline}
              onChange={(e) => onChange({ inline: e.target.checked })}
              className="size-3 accent-primary"
            />
            Inline
          </label>
        </div>
        <Textarea
          ref={valueRef}
          value={field.value}
          placeholder="Supports markdown and mentions"
          rows={6}
          maxLength={1024}
          onChange={(e) => onChange({ value: e.target.value })}
          className="resize-y px-2.5 py-1.5 text-[13px] md:text-[13px]"
        />
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 max-sm:order-3 max-sm:ml-auto max-sm:flex-row max-sm:gap-0">
        <RowIconButton
          title="Move up"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-3.5" />
        </RowIconButton>
        <RowIconButton
          title="Move down"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-3.5" />
        </RowIconButton>
        <RowIconButton title="Duplicate" onClick={onDuplicate}>
          <Copy className="size-3.5" />
        </RowIconButton>
        <RowIconButton title="Delete" onClick={onRemove} destructive>
          <Trash2 className="size-3.5" />
        </RowIconButton>
        <InsertMenu
          onInsert={insertIntoValue}
          triggerClassName="size-7 text-muted-foreground hover:bg-accent hover:text-foreground pointer-coarse:size-9"
          tooltipSide="left"
        />
        <AIButton
          iconOnly
          value={field.value}
          onApply={(next) => onChange({ value: next })}
        />
      </div>
    </div>
  );
}
