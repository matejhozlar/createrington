import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MOD_ENVIRONMENT_LABELS } from "@createrington/shared/workshop";
import type { ModEnvironment } from "@createrington/shared/db";
import { trpc } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import type { EnvironmentDisplay } from "@/features/workshop/components/EnvironmentCell";
import type { AttentionItem } from "@/features/admin/workshop/workshop-admin-detail/types";

type LingeringItem = { item: AttentionItem; environment: ModEnvironment };

export function useEnvironmentFlags({
  attention,
  keepFlaggedIssues,
  onChanged,
}: {
  attention: AttentionItem[] | undefined;
  keepFlaggedIssues: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<Map<number, ModEnvironment>>(
    new Map(),
  );
  const [lingering, setLingering] = useState<LingeringItem[]>([]);

  const clearPending = (projectId: number, environment: ModEnvironment) => {
    setPending((current) => {
      if (current.get(projectId) !== environment) return current;
      const next = new Map(current);
      next.delete(projectId);
      return next;
    });
  };

  const mutation = useMutation(
    trpc.admin.workshops.setProjectEnvironment.mutationOptions(
      useMutationToast({
        success: (project) =>
          project.environment === "unspecified"
            ? "Environment flag cleared"
            : `Flagged as ${MOD_ENVIRONMENT_LABELS[project.environment]}`,
        onSuccess: async (project, variables) => {
          setLingering((current) =>
            current.map((entry) =>
              entry.item.curseforgeProjectId === variables.curseforgeProjectId
                ? { ...entry, environment: project.environment }
                : entry,
            ),
          );
          await onChanged();
          clearPending(variables.curseforgeProjectId, variables.environment);
        },
        onError: (_err, variables) => {
          clearPending(variables.curseforgeProjectId, variables.environment);
          setLingering((current) =>
            current.filter(
              (entry) =>
                entry.item.curseforgeProjectId !==
                  variables.curseforgeProjectId ||
                entry.environment !== "unspecified",
            ),
          );
        },
      }),
    ),
  );

  const issueItems = useMemo(() => {
    const fresh = attention ?? [];
    if (lingering.length === 0) return fresh;
    const unresolved = new Set(
      fresh
        .filter((item) => item.type === "environment_unspecified")
        .map((item) => item.curseforgeProjectId),
    );
    return [
      ...fresh,
      ...lingering
        .filter((entry) => !unresolved.has(entry.item.curseforgeProjectId))
        .map((entry) => entry.item),
    ];
  }, [attention, lingering]);

  const envDisplay: EnvironmentDisplay = useMemo(() => {
    const merged = new Map<number, ModEnvironment>();
    for (const entry of lingering) {
      if (entry.environment === "unspecified") continue;
      merged.set(entry.item.curseforgeProjectId, entry.environment);
    }
    for (const [projectId, environment] of pending) {
      merged.set(projectId, environment);
    }
    return merged;
  }, [lingering, pending]);

  const setEnvironment = (projectId: number, environment: ModEnvironment) => {
    if (keepFlaggedIssues) {
      setLingering((current) => {
        if (
          current.some((entry) => entry.item.curseforgeProjectId === projectId)
        ) {
          return current;
        }
        const item = (attention ?? []).find(
          (row) =>
            row.type === "environment_unspecified" &&
            row.curseforgeProjectId === projectId,
        );
        return item
          ? [...current, { item, environment: "unspecified" }]
          : current;
      });
    }
    setPending((current) => new Map(current).set(projectId, environment));
    mutation.mutate({ curseforgeProjectId: projectId, environment });
  };

  const releaseFlaggedIssues = () => setLingering([]);

  return { envDisplay, issueItems, setEnvironment, releaseFlaggedIssues };
}
