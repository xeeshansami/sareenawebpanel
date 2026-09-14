import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api, {
  TOKEN_KEY, REFRESH_KEY, USER_KEY, ACTIVE_SHOP_KEY,
  setUnauthorizedHandler, errorMessage, getActiveShop, setActiveShop,
} from '../api/client.js';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [booting, setBooting] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));
  const [activeShopId, setActiveShopState] = useState(getActiveShop);

  /** Super Admin switching shops — every subsequent request carries it. */
  const switchShop = useCallback((shopId) => {
    setActiveShop(shopId);
    setActiveShopState(shopId || null);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem(TOKEN_KEY)) await api.post('/auth/logout');
    } catch {
      // ignore - clearing locally regardless
    }
    [TOKEN_KEY, REFRESH_KEY, USER_KEY, ACTIVE_SHOP_KEY].forEach((k) => localStorage.removeItem(k));
    setActiveShopState(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  // Revalidate the stored session on first load
  useEffect(() => {
    let cancelled = false;
    if (!localStorage.getItem(TOKEN_KEY)) {
      setBooting(false);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (cancelled) return;
        localStorage.setItem(USER_KEY, JSON.stringify(data.data));
        setUser(data.data);
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user: nextUser, token, refreshToken } = data.data;

    // Access is decided by capabilities, not by a level threshold: the panel
    // shows each role only what it may actually do (see Layout navigation).
    if (!nextUser.capabilities?.length) {
      const err = new Error('This account has no permissions assigned. Contact your administrator.');
      err.friendlyMessage = err.message;
      throw err;
    }

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      logout,
      isAuthenticated: Boolean(user),
      isSuperAdmin: Boolean(user?.isSuperAdmin),
      capabilities: user?.capabilities || [],
      can: (capability) => Boolean(user?.capabilities?.includes(capability)),
      shopId: user?.shopId || null,
      shop: user?.shop || null,
      activeShopId,
      switchShop,
      // Super Admin with no shop chosen is looking at the whole platform.
      viewingAllShops: Boolean(user?.isSuperAdmin) && !activeShopId,
    }),
    [user, booting, login, logout, activeShopId, switchShop]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export { errorMessage };
