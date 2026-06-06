import type { AuthResponse } from '@homebuddy/shared';

const ACCESS_KEY = 'homebuddy.accessToken';
const REFRESH_KEY = 'homebuddy.refreshToken';

const isBrowser = () => typeof window !== 'undefined';

export const authStore = {
  save(res: AuthResponse) {
    if (!isBrowser()) return;
    localStorage.setItem(ACCESS_KEY, res.accessToken);
    localStorage.setItem(REFRESH_KEY, res.refreshToken);
  },

  clear() {
    if (!isBrowser()) return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },

  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(REFRESH_KEY);
  },
};
