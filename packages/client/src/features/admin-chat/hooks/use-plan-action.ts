import { useMutation } from "@tanstack/react-query";
import { queryClient, trpc } from "@/lib/trpc";
import type { PlanCreateAction, PlanUpdateAction } from "../actions";

export function usePlanAction() {
  const create = useMutation(
    trpc.admin.planning.items.create.mutationOptions(),
  );
  const update = useMutation(
    trpc.admin.planning.items.update.mutationOptions(),
  );

  const apply = async (
    action: PlanCreateAction | PlanUpdateAction,
  ): Promise<number> => {
    if (action.type === "plan_create") {
      const { id } = await create.mutateAsync({
        title: action.title,
        body: action.body ?? null,
        category: action.category,
        subcategoryId: action.subcategoryId ?? null,
      });
      void queryClient.invalidateQueries(trpc.admin.planning.pathFilter());
      return id;
    }

    const current = await queryClient.fetchQuery(
      trpc.admin.planning.items.get.queryOptions(
        { id: action.id },
        { staleTime: 0 },
      ),
    );
    await update.mutateAsync({
      id: action.id,
      revision: current.item.revision,
      title: action.title,
      body: action.body,
      category: action.category,
      subcategoryId: action.subcategoryId,
      status: action.status,
    });
    void queryClient.invalidateQueries(trpc.admin.planning.pathFilter());
    return action.id;
  };

  return { apply, pending: create.isPending || update.isPending };
}
