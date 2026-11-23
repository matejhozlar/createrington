import { useMutation } from "@tanstack/react-query";
import { queryClient, trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

export function useUpvoteMod(slug: string, workshopId: number | undefined) {
  const toast = useToastActions();

  return useMutation(
    trpc.user.workshops.upvoteMod.mutationOptions({
      onMutate: async ({ workshopModId }) => {
        if (!slug || workshopId === undefined) return;
        const getKey = trpc.user.workshops.get.queryKey({ slug });
        const upvotesKey = trpc.user.workshops.myUpvotes.queryKey({
          workshopId,
        });
        await Promise.all([
          queryClient.cancelQueries(
            trpc.user.workshops.get.queryFilter({ slug }),
          ),
          queryClient.cancelQueries(
            trpc.user.workshops.myUpvotes.queryFilter({ workshopId }),
          ),
        ]);
        const previousGet = queryClient.getQueryData(getKey);
        const previousUpvotes = queryClient.getQueryData(upvotesKey);
        const removing =
          previousUpvotes?.modIds.includes(workshopModId) ?? false;
        queryClient.setQueryData(
          getKey,
          (data) =>
            data && {
              ...data,
              mods: data.mods.map((mod) =>
                mod.id === workshopModId
                  ? {
                      ...mod,
                      upvoteCount: Math.max(
                        0,
                        mod.upvoteCount + (removing ? -1 : 1),
                      ),
                    }
                  : mod,
              ),
            },
        );
        queryClient.setQueryData(
          upvotesKey,
          (data) =>
            data && {
              ...data,
              modIds: removing
                ? data.modIds.filter((id) => id !== workshopModId)
                : [...data.modIds, workshopModId],
              votesRemaining: removing
                ? Math.min(data.maxUpvotes, data.votesRemaining + 1)
                : Math.max(0, data.votesRemaining - 1),
            },
        );
        return { previousGet, previousUpvotes };
      },
      onError: (error, _input, context) => {
        if (slug && context?.previousGet) {
          queryClient.setQueryData(
            trpc.user.workshops.get.queryKey({ slug }),
            context.previousGet,
          );
        }
        if (workshopId !== undefined && context?.previousUpvotes) {
          queryClient.setQueryData(
            trpc.user.workshops.myUpvotes.queryKey({ workshopId }),
            context.previousUpvotes,
          );
        }
        toast.error(error.message);
      },
      onSettled: () => {
        if (slug) {
          void queryClient.invalidateQueries(
            trpc.user.workshops.get.queryFilter({ slug }),
          );
        }
        if (workshopId !== undefined) {
          void queryClient.invalidateQueries(
            trpc.user.workshops.myUpvotes.queryFilter({ workshopId }),
          );
        }
        void queryClient.invalidateQueries(
          trpc.user.workshops.list.pathFilter(),
        );
      },
    }),
  );
}
