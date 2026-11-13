import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface AuthUser {
  email: string;
  name: string;
  username: string;
  picture?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  sessionToken: string | null;
  isGuest: boolean;
  loading: boolean;
  signIn: (user: AuthUser, sessionToken: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STORAGE_KEY = "campusnav-auth-user";
const SESSION_STORAGE_KEY = "campusnav-auth-session";
const GUEST_STORAGE_KEY = "campusnav-guest-session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(AUTH_STORAGE_KEY),
      AsyncStorage.getItem(SESSION_STORAGE_KEY),
      AsyncStorage.getItem(GUEST_STORAGE_KEY),
    ])
      .then(([storedUser, storedSession, storedGuest]) => {
        if (storedUser && storedSession) {
          setUser(JSON.parse(storedUser) as AuthUser);
          setSessionToken(storedSession);
        }
        else if (storedGuest === "true") setIsGuest(true);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (nextUser: AuthUser, nextSessionToken: string) => {
    setUser(nextUser);
    setSessionToken(nextSessionToken);
    setIsGuest(false);
    await Promise.all([
      AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser)),
      AsyncStorage.setItem(SESSION_STORAGE_KEY, nextSessionToken),
      AsyncStorage.removeItem(GUEST_STORAGE_KEY),
    ]);
  }, []);

  const continueAsGuest = useCallback(async () => {
    setUser(null);
    setSessionToken(null);
    setIsGuest(true);
    await Promise.all([
      AsyncStorage.removeItem(AUTH_STORAGE_KEY),
      AsyncStorage.removeItem(SESSION_STORAGE_KEY),
      AsyncStorage.setItem(GUEST_STORAGE_KEY, "true"),
    ]);
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setSessionToken(null);
    setIsGuest(false);
    await Promise.all([
      AsyncStorage.removeItem(AUTH_STORAGE_KEY),
      AsyncStorage.removeItem(SESSION_STORAGE_KEY),
      AsyncStorage.removeItem(GUEST_STORAGE_KEY),
    ]);
  }, []);

  return (
    <AuthContext.Provider value={{ user, sessionToken, isGuest, loading, signIn, continueAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
