import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanningItemStatus } from "@createrington/shared/planning";
import { STATUS_CONFIG } from "../constants";
import { subcategoryName } from "../format";
import type { PlanningItem, PlanningSubcategory } from "../types";
import { PlanningCard } from "./PlanningCard";

interface PlanningBoardProps {
  statuses: readonly PlanningItemStatus[];
  items: PlanningItem[];
  subcategories: PlanningSubcategory[];
  showCategory: boolean;
  onOpen: (item: PlanningItem) => void;
  onMove: (item: PlanningItem, status: PlanningItemStatus) => void;
}

const COLUMN_GRID: Record<number, string> = {
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

function DraggableCard({
  item,
  subcategory,
  showCategory,
  onOpen,
}: {
  item: PlanningItem;
  subcategory: string | null;
  showCategory: boolean;
  onOpen: (item: PlanningItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(item);
      }}
      className={cn(
        "cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40",
      )}
    >
      <PlanningCard
        item={item}
        subcategory={subcategory}
        showCategory={showCategory}
      />
    </div>
  );
}

function Column({
  status,
  count,
  children,
}: {
  status: PlanningItemStatus;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { label, hint } = STATUS_CONFIG[status];

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2 transition-colors",
        isOver && "border-primary/40",
      )}
    >
      <header className="flex items-center gap-2 px-1 pt-1">
        <h2 className="text-sm font-semibold" title={hint}>
          {label}
        </h2>
        <Badge
          variant="outline"
          className="border-transparent bg-foreground/10"
        >
          {count}
        </Badge>
      </header>
      <div className="flex min-h-16 flex-col gap-2">{children}</div>
    </section>
  );
}

export function PlanningBoard({
  statuses,
  items,
  subcategories,
  showCategory,
  onOpen,
  onMove,
}: PlanningBoardProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const dragging = items.find((item) => item.id === draggingId);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    const item = items.find((candidate) => candidate.id === active.id);
    const status = over?.id as PlanningItemStatus | undefined;
    if (item && status && item.status !== status) onMove(item, status);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setDraggingId(Number(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div
        className={cn(
          "grid grid-cols-1 items-start gap-3 md:grid-cols-2",
          COLUMN_GRID[statuses.length],
        )}
      >
        {statuses.map((status) => {
          const columnItems = items.filter((item) => item.status === status);
          return (
            <Column key={status} status={status} count={columnItems.length}>
              {columnItems.map((item) => (
                <DraggableCard
                  key={item.id}
                  item={item}
                  subcategory={subcategoryName(
                    subcategories,
                    item.subcategoryId,
                  )}
                  showCategory={showCategory}
                  onOpen={onOpen}
                />
              ))}
            </Column>
          );
        })}
      </div>

      <DragOverlay>
        {dragging && (
          <PlanningCard
            item={dragging}
            subcategory={subcategoryName(subcategories, dragging.subcategoryId)}
            showCategory={showCategory}
            className="cursor-grabbing shadow-lg"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
