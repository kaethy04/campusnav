import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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
const STORAGE_KEY = "campusnav-places";
const RECENT_SEARCH_LIMIT = 10;

type PlacesData = {
  savedPlaces: string[];
  recentSearches: string[];
};

const EMPTY_PLACES: PlacesData = { savedPlaces: [], recentSearches: [] };

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Could not update saved places on this device.";
}

export function UserPlacesProvider({ children }: { children: React.ReactNode }) {
  const [places, setPlaces] = useState<PlacesData>(EMPTY_PLACES);
  const placesRef = useRef(EMPTY_PLACES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await AsyncStorage.multiRemove([
        "campusnav-auth-user",
        "campusnav-auth-session",
        "campusnav-guest-session",
      ]);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const data: unknown = stored ? JSON.parse(stored) : EMPTY_PLACES;
      if (
        !data ||
        typeof data !== "object" ||
        !("savedPlaces" in data) ||
        !Array.isArray(data.savedPlaces) ||
        !("recentSearches" in data) ||
        !Array.isArray(data.recentSearches)
      ) {
        throw new Error("Saved places on this device have an invalid format.");
      }
      const loaded = {
        savedPlaces: [...new Set(data.savedPlaces.filter((slug): slug is string => typeof slug === "string"))],
        recentSearches: [...new Set(data.recentSearches.filter((slug): slug is string => typeof slug === "string"))].slice(0, RECENT_SEARCH_LIMIT),
      };
      placesRef.current = loaded;
      setPlaces(loaded);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (next: PlacesData) => {
    placesRef.current = next;
    setPlaces(next);
    setError(null);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }, []);

  const toggleSavedPlace = useCallback(async (buildingSlug: string) => {
    const savedPlaces = placesRef.current.savedPlaces;
    const next = {
      ...placesRef.current,
      savedPlaces: savedPlaces.includes(buildingSlug)
        ? savedPlaces.filter((slug) => slug !== buildingSlug)
        : [...savedPlaces, buildingSlug],
    };
    await save(next);
  }, [save]);

  const recordRecentSearch = useCallback(async (buildingSlug: string) => {
    const recentSearches = placesRef.current.recentSearches.filter((slug) => slug !== buildingSlug);
    await save({
      ...placesRef.current,
      recentSearches: [buildingSlug, ...recentSearches].slice(0, RECENT_SEARCH_LIMIT),
    });
  }, [save]);

  const value = useMemo(() => ({
    savedPlaces: places.savedPlaces,
    recentSearches: places.recentSearches,
    loading,
    error,
    refresh,
    toggleSavedPlace,
    recordRecentSearch,
  }), [places, loading, error, refresh, toggleSavedPlace, recordRecentSearch]);

  return <UserPlacesContext.Provider value={value}>{children}</UserPlacesContext.Provider>;
}

export function useUserPlaces() {
  const context = useContext(UserPlacesContext);
  if (!context) throw new Error("useUserPlaces must be used inside UserPlacesProvider");
  return context;
}
