'use client';

import type { AuthResponse, MeResponse } from '@homebuddy/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from './api';
import { authStore } from './auth-store';

interface AuthContextValue {
  user: MeResponse | null;
  loading: boolean;
  setSession: (res: AuthResponse) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = authStore.getAccessToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    apiClient
      .me()
      .then(setUser)
      .catch(() => authStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const setSession = useCallback((res: AuthResponse) => {
    authStore.save(res);
    apiClient.me().then(setUser).catch(() => undefined);
  }, []);

  const signOut = useCallback(async () => {
    authStore.clear();
    setUser(null);
    void apiClient.logout().catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    const token = authStore.getAccessToken();
    if (!token) return;
    const me = await apiClient.me();
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setSession, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
