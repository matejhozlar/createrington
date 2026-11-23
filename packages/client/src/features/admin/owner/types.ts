import type { RouterOutput } from "@/lib/trpc";

type OwnerAdmins = RouterOutput["owner"]["admins"];

export type AdminRow = OwnerAdmins["list"]["admins"][number];
export type AdminCandidate = OwnerAdmins["searchPlayers"]["players"][number];
export type AdminAuditEntry = OwnerAdmins["auditLog"]["entries"][number];
export type PromoteResult = OwnerAdmins["promote"];
export type DemoteResult = OwnerAdmins["demote"];
