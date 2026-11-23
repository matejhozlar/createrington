import type { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface SortableRowProps {
  id: number;
  actions: ReactNode;
  children: ReactNode;
}

export function SortableRow({ id, actions, children }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex gap-1 rounded-md border border-border bg-card p-2 transition-shadow max-sm:flex-wrap",
        "hover:border-border-strong hover:shadow-sm",
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
        {children}
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 max-sm:order-3 max-sm:ml-auto max-sm:flex-row max-sm:gap-0">
        {actions}
      </div>
    </div>
  );
}
