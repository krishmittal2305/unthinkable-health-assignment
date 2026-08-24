import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    console.error("[ProtectedRoute] redirecting to /login: no user", { path: location.pathname });
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    console.error("[ProtectedRoute] redirecting to /login: role mismatch", {
      path: location.pathname,
      requiredRole: role,
      userRole: user.role,
    });
    return <Navigate to="/login" replace />;
  }

  return children;
}
