import type React from "react";
import { useAuth } from "@/contexts/auth/";
import { LoadingScreen } from "@/components/query-states";
import { NotFound } from "@/components/not-found";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

interface OwnerRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard for the `/owner/*` scope. Requires the authenticated user's
 * Discord ID to match the server-configured owner. The owner flag is
 * fetched via `user.account.me` so there's no dependency on adding it to
 * the JWT.
 */
export function OwnerRoute({ children }: OwnerRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const accountQuery = useQuery(
    trpc.user.account.me.queryOptions(undefined, {
      enabled: !!user,
    }),
  );

  if (authLoading || (user && accountQuery.isLoading)) {
    return <LoadingScreen progress={false} />;
  }

  if (!user || !accountQuery.data?.isOwner) {
    return <NotFound />;
  }

  return <>{children}</>;
}
