import React from "react";
import { useAuth } from "@/contexts/auth/";
import styles from "./ProtectedRoute.module.scss";

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
  const { user, loading, login } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  // Check authentication requirement
  if (requiresAuth && !user) {
    return (
      fallback || (
        <div className={styles.container}>
          <div className={styles.card}>
            <svg
              className={styles.icon}
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 className={styles.title}>Authentication Required</h2>
            <p className={styles.description}>
              You need to be logged in to access this page
            </p>
            <button className={styles.button} onClick={login}>
              Login with Discord
            </button>
          </div>
        </div>
      )
    );
  }

  // Check admin requirement
  if (requiresAdmin && user && !user.isAdmin) {
    return (
      fallback || (
        <div className={styles.container}>
          <div className={styles.card}>
            <svg
              className={styles.icon}
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 className={styles.title}>Admin Access Required</h2>
            <p className={styles.description}>
              You don't have permission to access this page
            </p>
            <a href="/" className={styles.button}>
              Go Home
            </a>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
};
