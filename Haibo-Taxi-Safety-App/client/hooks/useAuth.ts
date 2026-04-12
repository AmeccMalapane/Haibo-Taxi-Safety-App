import { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext";

/**
 * Hook to access auth state and actions.
 *
 * Usage:
 *   const { user, isAuthenticated, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context || Object.keys(context).length === 0) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
