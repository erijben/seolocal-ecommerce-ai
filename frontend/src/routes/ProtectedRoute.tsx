import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { hasAllowedRole } from "../auth/authorization";
import { useAuth } from "../context/authContextValue";
import type { UserRole } from "../types/auth";

type RouteGuardProps = {
  children: ReactNode;
};

type RoleProtectedRouteProps = RouteGuardProps & {
  allowedRoles: readonly UserRole[];
};

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      Chargement...
    </div>
  );
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function RoleProtectedRoute({
  allowedRoles,
  children,
}: RoleProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAllowedRole(user?.role, allowedRoles)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
