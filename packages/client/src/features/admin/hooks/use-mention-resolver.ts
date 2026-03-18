import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { MentionResolver } from "@/features/admin/tools/embed-builder/components/DiscordMarkdown";

function formatName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function useMentionResolver(): MentionResolver {
  const channelsQuery = trpc.admin.embeds.channels.useQuery();
  const rolesQuery = trpc.admin.embeds.roles.useQuery();

  return useMemo(() => {
    const channels = new Map<string, string>();
    for (const group of channelsQuery.data ?? []) {
      for (const ch of group.channels) {
        channels.set(ch.id, formatName(ch.name));
      }
    }
    const roles = new Map<string, string>();
    for (const role of rolesQuery.data ?? []) {
      roles.set(role.id, formatName(role.name));
    }
    return { channels, roles };
  }, [channelsQuery.data, rolesQuery.data]);
}
