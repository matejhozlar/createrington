import type React from "react";
import { useAuth } from "@/contexts/auth/";
import { LoadingScreen } from "@/components/query-states";
import { LoginPrompt } from "./login-prompt";
import { NotFound } from "@/components/not-found";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresAdmin?: boolean;
  promptLogin?: boolean;
}

export function ProtectedRoute({
  children,
  requiresAdmin = false,
  promptLogin = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen progress={false} />;
  }

  if (!user) {
    return promptLogin ? <LoginPrompt /> : <NotFound />;
  }

  if (requiresAdmin && !user.isAdmin) {
    return <NotFound />;
  }

  return <>{children}</>;
}
