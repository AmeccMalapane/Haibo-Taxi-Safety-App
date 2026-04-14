import React, { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";

// --- Types ---
export interface AuthUser {
  id: string;
  phone: string;
  email?: string | null;
  displayName?: string | null;
  role: string;
  avatarType?: string | null;
  avatarUrl?: string | null;
  referralCode?: string | null;
  walletBalance?: number | null;
  isVerified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGuest: boolean;
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
      AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, GUEST_KEY]).catch(() => {});
      setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        isGuest: false,
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
      const [token, refreshToken, userJson, isGuest] = await AsyncStorage.multiGet([
        TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, GUEST_KEY,
      ]);

      if (token[1] && userJson[1]) {
        const user = JSON.parse(userJson[1]);
        setState({
          user,
          token: token[1],
          refreshToken: refreshToken[1],
          isAuthenticated: true,
          isLoading: false,
          isGuest: false,
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
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, GUEST_KEY]);
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
      return { success: false, error: "Failed to send OTP. Please try again." };
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
    }}>
      {children}
    </AuthContext.Provider>
  );
}
