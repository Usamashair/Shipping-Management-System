"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loginRequest, logoutRequest, registerRequest, type RegisterPayload } from "@/lib/api/auth";
import { getUserProfile, userProfileToSessionUser } from "@/lib/api/profile";
import type { User } from "@/lib/types";

const TOKEN_KEY = "sms_auth_token";
const USER_KEY = "sms_auth_user";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  /** Replace the in-memory / session user (e.g. after profile completion). */
  setUser: (user: User) => void;
  /** Merge latest profile from `GET /api/user/profile` into session. */
  refreshUserProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = sessionStorage.getItem(TOKEN_KEY);
    startTransition(() => {
      setToken(t);
      setUser(readStoredUser());
      setLoading(false);
    });
  }, []);

  const applyAuthResponse = useCallback((res: { token: string; user: User }) => {
    sessionStorage.setItem(TOKEN_KEY, res.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await loginRequest(email, password);
      applyAuthResponse(res);
      return res.user;
    },
    [applyAuthResponse],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const res = await registerRequest(payload);
      applyAuthResponse(res);
      return res.user;
    },
    [applyAuthResponse],
  );

  const logout = useCallback(async () => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    try {
      if (t) {
        await logoutRequest(t);
      }
    } catch {
      // ignore network errors on logout
    }
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const setUserPersist = useCallback((next: User) => {
    sessionStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const refreshUserProfile = useCallback(async () => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    const u = readStoredUser();
    if (!t || !u) return;
    const profile = await getUserProfile(t);
    setUserPersist(userProfileToSessionUser(u, profile));
  }, [setUserPersist]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      login,
      register,
      logout,
      setUser: setUserPersist,
      refreshUserProfile,
    }),
    [token, user, loading, login, register, logout, setUserPersist, refreshUserProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
