import React from "react";
import { useAuth } from "@/contexts/auth/";
import { Loading } from "./loading-spinner";
import { NotFound } from "@/pages/not-found";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiresAuth = true,
  requiresAdmin = false,
  fallback,
}) => {
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return <Loading mode="fullscreen" size="large" text="Loading..." />;
  }

  // Check authentication requirement
  if (requiresAuth && !user) {
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
};
