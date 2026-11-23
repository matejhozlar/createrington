import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Rows3, Trash2 } from "lucide-react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/query-states";
import { cn } from "@/lib/utils";
import { insertAtCursor } from "@/lib/insertAtCursor";
import { moveItem } from "@/lib/moveItem";
import {
  EMBED_MAX_FIELDS,
  type EmbedField,
} from "@createrington/shared/api/embed";
import { InsertMenu } from "@/features/admin/components/InsertMenu";
import {
  AIButton,
  COMPACT_BUTTON,
  RowIconButton,
  SectionHead,
} from "@/features/admin/tools/embed-builder/components/form-primitives";
import { useDragSensors } from "@/features/admin/tools/embed-builder/hooks/use-drag-sensors";
import { useItemKeys } from "@/features/admin/tools/embed-builder/hooks/use-item-keys";
import { SortableRow } from "./SortableRow";
import type { TabProps } from "./types";

export function FieldsTab({ data, set, focused, setFocused }: TabProps) {
  const fields = data.fields;
  const sensors = useDragSensors();
  const rowKeys = useItemKeys(fields.length);
  const full = fields.length >= EMBED_MAX_FIELDS;

  function update(i: number, updates: Partial<EmbedField>) {
    set({
      fields: fields.map((f, j) => (j === i ? { ...f, ...updates } : f)),
    });
  }
  function remove(i: number) {
    rowKeys.remove(i);
    set({ fields: fields.filter((_, j) => j !== i) });
  }
  function add() {
    if (full) return;
    set({ fields: [...fields, { name: "", value: "", inline: false }] });
    setFocused?.(`field:${fields.length}`);
  }
  function move(i: number, dir: -1 | 1) {
    rowKeys.move(i, dir);
    set({ fields: moveItem(fields, i, dir) });
  }
  function duplicate(i: number) {
    if (full) return;
    rowKeys.insert(i + 1);
    set({
      fields: [
        ...fields.slice(0, i + 1),
        { ...fields[i] },
        ...fields.slice(i + 1),
      ],
    });
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = rowKeys.indexOf(active.id);
    const to = rowKeys.indexOf(over.id);
    if (from < 0 || to < 0) return;
    rowKeys.reorder(from, to);
    set({ fields: arrayMove(fields, from, to) });
  }

  return (
    <>
      <SectionHead
        title="Fields"
        count={`${fields.length}/${EMBED_MAX_FIELDS}`}
        right={
          <Button
            variant="outline"
            size="sm"
            className={COMPACT_BUTTON}
            disabled={full}
            onClick={add}
          >
            <Plus className="mr-1 size-3" />
            Add field
          </Button>
        }
      />

      {fields.length === 0 && (
        <EmptyState
          icon={Rows3}
          message="No fields yet"
          hint="Fields are name/value rows shown below the description. Use them for structured info like server stats, links, or rules."
        >
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="mr-1 size-3.5" />
            Add your first field
          </Button>
        </EmptyState>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={rowKeys.keys}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {fields.map((f, i) => (
              <FieldRow
                key={rowKeys.keys[i]}
                id={rowKeys.keys[i]}
                field={f}
                index={i}
                count={fields.length}
                focused={focused === `field:${i}`}
                canDuplicate={!full}
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
  canDuplicate,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
}: {
  id: number;
  field: EmbedField;
  index: number;
  count: number;
  focused: boolean;
  canDuplicate: boolean;
  onChange: (updates: Partial<EmbedField>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (focused) nameRef.current?.focus();
  }, [focused]);

  function insertIntoValue(text: string) {
    insertAtCursor(valueRef.current, field.value, text, (value) =>
      onChange({ value }),
    );
  }

  return (
    <SortableRow
      id={id}
      actions={
        <>
          <RowIconButton
            icon={ArrowUp}
            label="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          />
          <RowIconButton
            icon={ArrowDown}
            label="Move down"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          />
          <RowIconButton
            icon={Copy}
            label="Duplicate"
            disabled={!canDuplicate}
            onClick={onDuplicate}
          />
          <RowIconButton
            icon={Trash2}
            label="Delete"
            onClick={onRemove}
            destructive
          />
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
        </>
      }
    >
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
              ? "border-border-strong bg-accent text-foreground"
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
    </SortableRow>
  );
}
