import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/query-states";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { personName } from "../format";
import type { PlanningSubcategory } from "../types";
import { ItemComments } from "./ItemComments";
import { ItemEditor } from "./ItemEditor";
import { ItemHistory } from "./ItemHistory";

interface ItemSheetProps {
  itemId: number | null;
  onClose: () => void;
  subcategories: PlanningSubcategory[];
}

function CountBadge({ count }: { count: number }) {
  return (
    <Badge variant="outline" className="border-transparent bg-foreground/10">
      {count}
    </Badge>
  );
}

export function ItemSheet({ itemId, onClose, subcategories }: ItemSheetProps) {
  const [shownId, setShownId] = useState(itemId);
  if (itemId !== null && itemId !== shownId) setShownId(itemId);

  const query = useQuery(
    trpc.admin.planning.items.get.queryOptions(
      { id: shownId ?? 0 },
      { enabled: shownId !== null },
    ),
  );
  const data = query.data;

  return (
    <Sheet
      open={itemId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>Card #{shownId}</SheetTitle>
          <SheetDescription>
            {data
              ? `Added by ${personName(data.item.createdBy)} ${formatRelativeDate(data.item.createdAt)}, last edited by ${personName(data.item.updatedBy)} ${formatRelativeDate(data.item.updatedAt)}`
              : "Loading the card"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {query.error ? (
            <ErrorState
              message={query.error.message}
              onRetry={() => query.refetch()}
            />
          ) : !data ? (
            <LoadingState />
          ) : (
            <div className="flex flex-col gap-6">
              <ItemEditor
                key={data.item.id}
                item={data.item}
                subcategories={subcategories}
                onDeleted={onClose}
              />

              <Tabs defaultValue="discussion" className="gap-4">
                <TabsList className="text-foreground/80">
                  <TabsTrigger value="discussion">
                    Discussion
                    <CountBadge count={data.comments.length} />
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    History
                    <CountBadge count={data.revisions.length} />
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="discussion">
                  <ItemComments
                    itemId={data.item.id}
                    comments={data.comments}
                  />
                </TabsContent>
                <TabsContent value="history">
                  <ItemHistory
                    itemId={data.item.id}
                    currentRevision={data.item.revision}
                    revisions={data.revisions}
                    subcategories={subcategories}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
