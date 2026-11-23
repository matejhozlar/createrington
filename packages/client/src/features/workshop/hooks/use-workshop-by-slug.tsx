import type { ReactElement } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { ErrorState, LoadingState } from "@/components/query-states";
import { NotFound } from "@/components/not-found";
import { WorkshopDisabledState } from "@/features/workshop/components/WorkshopEmptyState";

type WorkshopData = RouterOutput["user"]["workshops"]["get"];

type GateQuery = {
  error: { message: string; data?: { code?: string } | null } | null;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
};

type Gate =
  | { data: WorkshopData; fallback?: never }
  | { data?: never; fallback: ReactElement };

export function useWorkshopBySlug(loadingText: string) {
  const { slug = "" } = useParams<{ slug: string }>();
  const workshopQuery = useQuery(
    trpc.user.workshops.get.queryOptions(
      { slug },
      { enabled: !!slug, retry: false },
    ),
  );

  const gate = ({
    failOn = [],
    waitFor = [],
  }: { failOn?: GateQuery[]; waitFor?: GateQuery[] } = {}): Gate => {
    if (workshopQuery.error?.data?.code === "NOT_FOUND") {
      return { fallback: <NotFound /> };
    }

    const failed = [workshopQuery, ...failOn].filter((query) => query.error);
    const error = failed[0]?.error;
    if (error) {
      return {
        fallback: (
          <div className="px-5 py-10 md:px-8">
            <div className="mx-auto max-w-6xl">
              {error.data?.code === "FORBIDDEN" ? (
                <WorkshopDisabledState />
              ) : (
                <ErrorState
                  bordered
                  message={error.message}
                  onRetry={() => {
                    for (const query of failed) void query.refetch();
                  }}
                />
              )}
            </div>
          </div>
        ),
      };
    }

    const loading = [workshopQuery, ...failOn, ...waitFor].some(
      (query) => query.isLoading,
    );
    if (loading || !workshopQuery.data) {
      return {
        fallback: (
          <LoadingState
            size="large"
            text={loadingText}
            className="flex-none px-0 py-32"
          />
        ),
      };
    }

    return { data: workshopQuery.data };
  };

  return { slug, workshopId: workshopQuery.data?.workshop.id, gate };
}
