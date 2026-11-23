import { trpc, queryClient } from "@/lib/trpc";

export function invalidateWorkshopMods(workshopId: number) {
  return Promise.all([
    queryClient.invalidateQueries(
      trpc.admin.workshops.listMods.queryFilter({ workshopId }),
    ),
    queryClient.invalidateQueries(trpc.admin.workshops.getMod.pathFilter()),
    queryClient.invalidateQueries(
      trpc.admin.workshops.searchProjects.queryFilter({ workshopId }),
    ),
    queryClient.invalidateQueries(
      trpc.admin.workshops.listPackMods.queryFilter({ workshopId }),
    ),
    queryClient.invalidateQueries(
      trpc.admin.workshops.attention.queryFilter({ workshopId }),
    ),
    queryClient.invalidateQueries(
      trpc.admin.workshops.listDependencies.queryFilter({ workshopId }),
    ),
    queryClient.invalidateQueries(
      trpc.admin.workshops.listEvents.queryFilter({ workshopId }),
    ),
    queryClient.invalidateQueries(trpc.user.workshops.list.pathFilter()),
    queryClient.invalidateQueries(trpc.user.workshops.get.pathFilter()),
    queryClient.invalidateQueries(
      trpc.user.workshops.listRejected.queryFilter({ workshopId }),
    ),
    queryClient.invalidateQueries(
      trpc.user.workshops.getPack.queryFilter({ workshopId }),
    ),
  ]);
}
