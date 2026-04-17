import React, { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";

// --- Types ---
export interface AuthUser {
  id: string;
  phone: string;
  email?: string | null;
  handle?: string | null;
  displayName?: string | null;
  role: string;
  // Every persona this user can step into (commuter baseline + any
  // linked driver/owner/vendor profiles). Drives the role switcher.
  // Fetched from /api/auth/me; cached user rows from older sessions
  // may omit it, hence optional.
  availableRoles?: string[];
  avatarType?: string | null;
  avatarUrl?: string | null;
  referralCode?: string | null;
  walletBalance?: number | null;
  // Driver-only sub-balance — money earned that routes to the linked
  // owner's bank on settlement. Always 0 for non-drivers. Phase C.
  fareBalance?: number | null;
  isVerified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGuest: boolean;
  // Currently selected persona. Falls back to user.role on first login
  // or whenever the persisted value is no longer in availableRoles.
  activeRole: string | null;
}

interface AuthContextType extends AuthState {
  login: (phone: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  sendOTP: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  skipAuth: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<{ success: boolean; error?: string }>;
  getToken: () => string | null;
  setActiveRole: (role: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  phone: string;
  email?: string;
  password?: string;
  displayName?: string;
}

// --- Storage keys ---
const TOKEN_KEY = "@haibo_auth_token";
const REFRESH_TOKEN_KEY = "@haibo_auth_refresh_token";
const USER_KEY = "@haibo_auth_user";
const GUEST_KEY = "@haibo_auth_guest";
const ACTIVE_ROLE_KEY = "@haibo_active_role";

// --- Singletons so query-client (outside the React tree) can read tokens
//     and trigger auth side effects without prop drilling. ---
let _currentToken: string | null = null;
let _currentRefreshToken: string | null = null;
let _onAuthExpired: (() => void) | null = null;
let _onTokensRefreshed: ((token: string, refreshToken: string) => Promise<void>) | null = null;

export function getCurrentToken(): string | null {
  return _currentToken;
}
export function getCurrentRefreshToken(): string | null {
  return _currentRefreshToken;
}
export function notifyAuthExpired(): void {
  _onAuthExpired?.();
}
export async function saveRefreshedTokens(token: string, refreshToken: string): Promise<void> {
  // Update singletons synchronously so in-flight retries read the new value
  // before React has a chance to re-render.
  _currentToken = token;
  _currentRefreshToken = refreshToken;
  await _onTokensRefreshed?.(token, refreshToken);
}

// Clamp a persisted role to what the current user is still eligible
// for. Guards against the case where a user lost a linked profile
// (e.g. driver unlinked by owner) between sessions.
function resolveActiveRole(stored: string | null | undefined, user: AuthUser | null): string | null {
  if (!user) return null;
  const available = user.availableRoles && user.availableRoles.length > 0
    ? user.availableRoles
    : [user.role];
  if (stored && available.includes(stored)) return stored;
  return user.role || null;
}

// --- Context ---
export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// --- Provider ---
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    isGuest: false,
    activeRole: null,
  });

  // Load persisted auth on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Keep singletons in sync with React state
  useEffect(() => {
    _currentToken = state.token;
    _currentRefreshToken = state.refreshToken;
  }, [state.token, state.refreshToken]);

  // Wire query-client callbacks once on mount so it can trigger logout on
  // refresh failure and persist refreshed tokens without re-rendering this
  // provider on every request.
  useEffect(() => {
    _onAuthExpired = () => {
      AsyncStorage.multiRemove([
        TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, GUEST_KEY, ACTIVE_ROLE_KEY,
      ]).catch(() => {});
      setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        isGuest: false,
        activeRole: null,
      });
    };
    _onTokensRefreshed = async (token: string, refreshToken: string) => {
      await AsyncStorage.multiSet([
        [TOKEN_KEY, token],
        [REFRESH_TOKEN_KEY, refreshToken],
      ]);
      setState(prev => ({ ...prev, token, refreshToken }));
    };
    return () => {
      _onAuthExpired = null;
      _onTokensRefreshed = null;
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [token, refreshToken, userJson, isGuest, storedRole] = await AsyncStorage.multiGet([
        TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, GUEST_KEY, ACTIVE_ROLE_KEY,
      ]);

      if (token[1] && userJson[1]) {
        const user = JSON.parse(userJson[1]) as AuthUser;
        setState({
          user,
          token: token[1],
          refreshToken: refreshToken[1],
          isAuthenticated: true,
          isLoading: false,
          isGuest: false,
          activeRole: resolveActiveRole(storedRole[1], user),
        });
      } else if (isGuest[1] === "true") {
        setState(prev => ({ ...prev, isLoading: false, isGuest: true }));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to load auth state:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const persistAuth = async (token: string, refreshToken: string, user: AuthUser) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [REFRESH_TOKEN_KEY, refreshToken],
      [USER_KEY, JSON.stringify(user)],
    ]);
    await AsyncStorage.removeItem(GUEST_KEY);
  };

  const clearAuth = async () => {
    await AsyncStorage.multiRemove([
      TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, GUEST_KEY, ACTIVE_ROLE_KEY,
    ]);
  };

  // --- Auth actions ---

  const login = useCallback(async (phone: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!getApiUrl()) return { success: false, error: "API not configured" };

      const body: any = { phone };
      if (password) body.password = password;

      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await persistAuth(data.token, data.refreshToken, data.user);
      setState({
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        isGuest: false,
        activeRole: data.user?.role || null,
      });

      return { success: true };
    } catch (error: any) {
      const msg = error.message?.includes("401") ? "Invalid credentials" : "Login failed. Please try again.";
      return { success: false, error: msg };
    }
  }, []);

  const register = useCallback(async (regData: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!getApiUrl()) return { success: false, error: "API not configured" };

      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(regData),
      });

      await persistAuth(data.token, data.refreshToken, data.user);
      setState({
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        isGuest: false,
        activeRole: data.user?.role || null,
      });

      return { success: true };
    } catch (error: any) {
      const msg = error.message?.includes("409") ? "Account already exists with this phone number" : "Registration failed. Please try again.";
      return { success: false, error: msg };
    }
  }, []);

  const sendOTP = useCallback(async (phone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!getApiUrl()) return { success: false, error: "API not configured" };

      await apiRequest("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });

      return { success: true };
    } catch (error: any) {
      // apiRequest throws `${status}: ${body}` for non-2xx — strip the
      // status prefix so users see the server's actual reason (e.g. the
      // 502 message from SMS delivery failures) instead of a generic
      // "try again". Fall back to the generic string if the shape isn't
      // what we expect.
      const raw = String(error?.message || "");
      const match = raw.match(/^\d+:\s*(\{.*\}|.+)$/);
      let serverMessage: string | undefined;
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          serverMessage = parsed?.error || parsed?.message;
        } catch {
          serverMessage = match[1];
        }
      }
      return {
        success: false,
        error: serverMessage || "Failed to send OTP. Please try again.",
      };
    }
  }, []);

  const verifyOTP = useCallback(async (phone: string, code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!getApiUrl()) return { success: false, error: "API not configured" };

      const data = await apiRequest("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });

      await persistAuth(data.token, data.refreshToken, data.user);
      setState({
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        isGuest: false,
        activeRole: data.user?.role || null,
      });

      return { success: true };
    } catch (error: any) {
      const msg = error.message?.includes("400") ? "Invalid or expired OTP" : "Verification failed. Please try again.";
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isGuest: false,
      activeRole: null,
    });
  }, []);

  const skipAuth = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, "true");
    setState(prev => ({ ...prev, isGuest: true }));
  }, []);

  const updateProfile = useCallback(async (data: Partial<AuthUser>): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!getApiUrl() || !state.token) return { success: false, error: "Not authenticated" };

      const updated = await apiRequest("/api/auth/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${state.token}` },
        body: JSON.stringify(data),
      });

      const newUser = { ...state.user!, ...updated };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setState(prev => ({ ...prev, user: newUser }));

      return { success: true };
    } catch (error: any) {
      return { success: false, error: "Failed to update profile" };
    }
  }, [state.token, state.user]);

  const getToken = useCallback(() => state.token, [state.token]);

  const refreshUser = useCallback(async () => {
    // Re-fetch the full user from /me so availableRoles, walletBalance,
    // fareBalance etc. stay fresh after the user completes an action
    // that promotes their role (owner onboarding, driver invitation
    // redemption, vendor KYC etc.). Silently bails if not authed.
    if (!state.token) return;
    try {
      const fresh = (await apiRequest("/api/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${state.token}` },
      })) as AuthUser;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
      setState(prev => ({
        ...prev,
        user: fresh,
        activeRole: resolveActiveRole(prev.activeRole, fresh),
      }));
    } catch {
      // Non-fatal — the stale user data is already in state.
    }
  }, [state.token]);

  const setActiveRole = useCallback(async (role: string) => {
    // Reject roles the user isn't eligible for so a stale cached value
    // can't escalate them into a persona they've lost access to.
    const available = state.user?.availableRoles && state.user.availableRoles.length > 0
      ? state.user.availableRoles
      : state.user?.role
        ? [state.user.role]
        : [];
    if (!available.includes(role)) return;
    await AsyncStorage.setItem(ACTIVE_ROLE_KEY, role);
    setState(prev => ({ ...prev, activeRole: role }));
  }, [state.user?.availableRoles, state.user?.role]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      sendOTP,
      verifyOTP,
      logout,
      skipAuth,
      updateProfile,
      getToken,
      setActiveRole,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
