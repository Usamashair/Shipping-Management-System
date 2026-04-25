"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getUserProfile } from "@/lib/api/profile";
import { useAuth } from "@/lib/auth/context";
import type { UserProfile } from "@/lib/types";

type ProfileContextValue = {
  profile: UserProfile | null;
  profileLoading: boolean;
  setProfile: (p: UserProfile) => void;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const data = await getUserProfile(token);
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    void refreshProfile();
  }, [token, user, refreshProfile]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      profileLoading,
      setProfile,
      refreshProfile,
    }),
    [profile, profileLoading, refreshProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
