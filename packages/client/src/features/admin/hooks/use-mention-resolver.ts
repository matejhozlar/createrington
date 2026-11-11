import { useMemo } from "react";
import { camelCaseToTitle } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import type { MentionResolver } from "@/features/admin/tools/embed-builder/components/DiscordMarkdown";
import { useQuery } from "@tanstack/react-query";

export function useMentionResolver(): MentionResolver {
  const channelsQuery = useQuery(trpc.admin.embeds.channels.queryOptions());
  const rolesQuery = useQuery(trpc.admin.embeds.roles.queryOptions());

  return useMemo(() => {
    const channels = new Map<string, string>();
    for (const group of channelsQuery.data ?? []) {
      for (const ch of group.channels) {
        channels.set(ch.id, camelCaseToTitle(ch.name));
      }
    }
    const roles = new Map<string, string>();
    for (const role of rolesQuery.data ?? []) {
      roles.set(role.id, camelCaseToTitle(role.name));
    }
    return { channels, roles };
  }, [channelsQuery.data, rolesQuery.data]);
}
