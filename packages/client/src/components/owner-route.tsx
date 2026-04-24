import type React from "react";
import { useAuth } from "@/contexts/auth/";
import { Loading } from "./loading-spinner";
import { NotFound } from "@/pages/not-found";
import { trpc } from "@/lib/trpc";

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
  const accountQuery = trpc.user.account.me.useQuery(undefined, {
    enabled: !!user,
  });

  if (authLoading || (user && accountQuery.isLoading)) {
    return <Loading mode="fullscreen" size="large" text="Loading..." />;
  }

  if (!user || !accountQuery.data?.isOwner) {
    return <NotFound />;
  }

  return <>{children}</>;
}
