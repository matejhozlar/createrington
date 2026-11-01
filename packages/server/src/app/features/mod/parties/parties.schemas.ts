import { mcUuid } from "@/utils/zod-schemas";
import { PARTY_MEMBER_RANKS } from "@createrington/shared/party";
import { z } from "zod";
import { dimensionId, syncList, syncName } from "../shared/sync-schemas";

export const MAX_PARTY_SYNC_PARTIES = 2_000;
export const MAX_PARTY_SYNC_PLAYERS = 200;
export const MAX_PARTY_DESCRIPTION_LENGTH = 1_000;
export const MAX_PARTY_TAG_CODE_LENGTH = 255;
export const MAX_PARTY_CLAIM_DIMENSIONS = 100;
export const MAX_PARTY_CLAIM_CHUNKS = 100_000;
export const MAX_PARTY_CLAIM_HASH_LENGTH = 64;

const chunkCount = z.int32().nonnegative().nullable();

const PartyMemberSchema = z.object({
  uuid: mcUuid,
  rank: z.enum(PARTY_MEMBER_RANKS),
  claims: chunkCount,
  forceloads: chunkCount,
});

const PartySchema = z
  .object({
    teamId: mcUuid,
    name: syncName,
    description: z.string().max(MAX_PARTY_DESCRIPTION_LENGTH),
    color: z.int32(),
    freeToJoin: z.boolean(),
    members: syncList(PartyMemberSchema, MAX_PARTY_SYNC_PLAYERS),
    allies: syncList(mcUuid, MAX_PARTY_SYNC_PLAYERS),
    tagCode: z.string().max(MAX_PARTY_TAG_CODE_LENGTH).nullable(),
  })
  .refine(
    ({ members }) => members.filter((m) => m.rank === "owner").length === 1,
    { message: "a party has exactly one owner", path: ["members"] },
  );

export const PartySyncBodySchema = z.object({
  parties: syncList(PartySchema, MAX_PARTY_SYNC_PARTIES),
});

export type PartySyncBody = z.infer<typeof PartySyncBodySchema>;
export type PartySyncParty = PartySyncBody["parties"][number];

const chunkPos = z.tuple([z.int32(), z.int32()]);

const PartyClaimOwnerSchema = z.object({
  owner: mcUuid,
  claims: syncList(chunkPos, MAX_PARTY_CLAIM_CHUNKS),
  forceloads: syncList(chunkPos, MAX_PARTY_CLAIM_CHUNKS),
});

const PartyClaimDimensionSchema = z.object({
  dimension: dimensionId,
  owners: syncList(PartyClaimOwnerSchema),
});

export const PartyClaimsBodySchema = z.object({
  hash: z.string().min(1).max(MAX_PARTY_CLAIM_HASH_LENGTH),
  dimensions: syncList(PartyClaimDimensionSchema, MAX_PARTY_CLAIM_DIMENSIONS),
});

export type PartyClaimsBody = z.infer<typeof PartyClaimsBodySchema>;
