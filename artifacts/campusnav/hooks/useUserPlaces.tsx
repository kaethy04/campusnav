import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getApiBaseUrl } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";

interface UserPlacesContextValue {
  savedPlaces: string[];
  recentSearches: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleSavedPlace: (buildingSlug: string) => Promise<void>;
  recordRecentSearch: (buildingSlug: string) => Promise<void>;
}

const UserPlacesContext = createContext<UserPlacesContextValue | null>(null);

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Could not update your saved places.";
}

export function UserPlacesProvider({ children }: { children: React.ReactNode }) {
  const { user, sessionToken, signOut } = useAuth();
  const [savedPlaces, setSavedPlaces] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    if (!sessionToken) throw new Error("Sign in to sync your places.");
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401) {
      await signOut();
      throw new Error(data?.error || "Your session expired. Please sign in again.");
    }
    if (!response.ok) throw new Error(data?.error || "Could not update your saved places.");
    return data;
  }, [sessionToken, signOut]);

  const refresh = useCallback(async () => {
    if (!user || !sessionToken) {
      setSavedPlaces([]);
      setRecentSearches([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await request("/api/users/me/places");
      if (!Array.isArray(data?.savedPlaces) || !Array.isArray(data?.recentSearches)) {
        throw new Error("The server returned an invalid places response.");
      }
      setSavedPlaces(data.savedPlaces.filter((slug: unknown): slug is string => typeof slug === "string"));
      setRecentSearches(data.recentSearches.filter((slug: unknown): slug is string => typeof slug === "string"));
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [request, sessionToken, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleSavedPlace = useCallback(async (buildingSlug: string) => {
    if (!user || !sessionToken) return;
    setError(null);
    try {
      const isSaved = savedPlaces.includes(buildingSlug);
      await request(
        isSaved
          ? `/api/users/me/saved-places/${encodeURIComponent(buildingSlug)}`
          : "/api/users/me/saved-places",
        isSaved
          ? { method: "DELETE" }
          : { method: "POST", body: JSON.stringify({ buildingSlug }) },
      );
      await refresh();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }, [refresh, request, savedPlaces, sessionToken, user]);

  const recordRecentSearch = useCallback(async (buildingSlug: string) => {
    if (!user || !sessionToken) return;
    setError(null);
    try {
      await request("/api/users/me/recent-searches", {
        method: "POST",
        body: JSON.stringify({ buildingSlug }),
      });
      await refresh();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }, [refresh, request, sessionToken, user]);

  const value = useMemo(() => ({
    savedPlaces,
    recentSearches,
    loading,
    error,
    refresh,
    toggleSavedPlace,
    recordRecentSearch,
  }), [savedPlaces, recentSearches, loading, error, refresh, toggleSavedPlace, recordRecentSearch]);

  return <UserPlacesContext.Provider value={value}>{children}</UserPlacesContext.Provider>;
}

export function useUserPlaces() {
  const context = useContext(UserPlacesContext);
  if (!context) throw new Error("useUserPlaces must be used inside UserPlacesProvider");
  return context;
}
