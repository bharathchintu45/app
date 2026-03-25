import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AppUser, UserRole } from '../types';
import { requestNotificationPermission } from '../hooks/useOrderNotifications';

interface UserContextType {
  user: AppUser | null;
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem("tfb_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef<{ id: string; time: number } | null>(null);

  const fetchUserProfile = useCallback(async (userId: string, email: string) => {
    if (!userId || isFetchingRef.current) return;
    
    const now = Date.now();
    if (lastFetchRef.current?.id === userId && (now - lastFetchRef.current.time < 5000)) {
       return;
    }

    try {
      isFetchingRef.current = true;
      lastFetchRef.current = { id: userId, time: now };

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("[UserContext] Profile fetch error:", error);
        return;
      }

      if (profile) {
        const loggedInUser: AppUser = {
          id: profile.id,
          name: profile.full_name || "Valued Customer",
          phone: profile.phone_number || "",
          email: email || "",
          role: (profile.role as UserRole) || "customer",
          isPro: profile.is_pro || false,
          defaultDelivery: profile.default_delivery || undefined,
          savedAddresses: Array.isArray(profile.saved_addresses) ? profile.saved_addresses : [],
        };
        setUser(loggedInUser);
        localStorage.setItem("tfb_user", JSON.stringify(loggedInUser));
        requestNotificationPermission();
      }
    } catch (err) {
      console.error("[UserContext] Exception fetching profile:", err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem("tfb_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("tfb_user");
    }
  }, [user]);

  useEffect(() => {
    // Initial Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email || "");
      } else {
        localStorage.removeItem("tfb_user");
        setLoading(false);
      }
    });

    // Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        fetchUserProfile(session.user.id, session.user.email || "");
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("tfb_user");
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await fetchUserProfile(session.user.id, session.user.email || "");
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser, loading, refreshProfile, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
