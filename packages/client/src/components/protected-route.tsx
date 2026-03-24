import type React from "react";
import { useAuth } from "@/contexts/auth/";
import { Loading } from "./loading-spinner";
import { LoginPrompt } from "./login-prompt";
import { NotFound } from "@/pages/not-found";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  promptLogin?: boolean;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiresAuth = true,
  requiresAdmin = false,
  promptLogin = false,
  fallback,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return <Loading mode="fullscreen" size="large" text="Loading..." />;
  }

  // Check authentication requirement
  if (requiresAuth && !user) {
    if (promptLogin) {
      return <LoginPrompt />;
    }
    return fallback || <NotFound />;
  }

  // Check admin requirement
  if (requiresAdmin && user && !user.isAdmin) {
    return (
      fallback || (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Admin Access Required</h2>
          <p>You don't have permission to access this page</p>
          <a href="/">Go Home</a>
        </div>
      )
    );
  }

  return <>{children}</>;
}
