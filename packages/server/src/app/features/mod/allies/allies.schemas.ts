import { mcUuid } from "@/utils/zod-schemas";
import { z } from "zod";
import { syncList, syncName } from "../shared/sync-schemas";

const QualifiedPlayerSchema = z.object({
  uuid: mcUuid,
  qualifiedAt: z.number(),
});

export const AllySyncBodySchema = z.object({
  fakePlayerParty: z.object({
    partyId: mcUuid,
    ownerUuid: mcUuid,
    ownerName: syncName.min(1),
    members: syncList(z.object({ uuid: mcUuid })),
  }),
  allies: syncList(
    z.object({
      partyId: mcUuid,
      alliedAt: z.number(),
    }),
  ),
  qualified: syncList(QualifiedPlayerSchema),
  pending: syncList(QualifiedPlayerSchema),
});

export type AllySyncBody = z.infer<typeof AllySyncBodySchema>;
