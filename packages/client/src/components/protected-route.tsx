import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { Loading } from "./Loading";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading text="Loading..." />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !user.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
