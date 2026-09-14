import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { getCostUnlock, setCostUnlock, clearCostUnlock, errorMessage, CAPS } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const CostUnlockContext = createContext(null);

/**
 * Step-up state for purchase prices.
 *
 * The app never decides whether cost is visible — the API does, by including
 * the fields or not. This only tracks whether we currently hold an unlock, so
 * the UI can show a prompt instead of a suspiciously empty column.
 */
export function CostUnlockProvider({ children }) {
  const { can, activeShopId } = useAuth();
  const [held, setHeld] = useState(getCostUnlock);
  const [prompting, setPrompting] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Switching shops invalidates the unlock — it was earned for one shop.
  useEffect(() => { setHeld(getCostUnlock()); }, [activeShopId]);

  // Re-lock the moment it expires, rather than waiting for a failed request.
  useEffect(() => {
    if (!held) return undefined;
    const ms = new Date(held.expiresAt).getTime() - Date.now();
    if (ms <= 0) { setHeld(null); return undefined; }
    const t = setTimeout(() => { clearCostUnlock(); setHeld(null); }, ms);
    return () => clearTimeout(t);
  }, [held]);

  const unlock = useCallback(async (password) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/verify-sensitive-access', { password });
      const next = {
        token: data.data.costUnlockToken,
        expiresAt: data.data.expiresAt,
        shopId: data.data.shopId,
      };
      setCostUnlock(next);
      setHeld(next);
      setPrompting(false);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const lock = useCallback(() => { clearCostUnlock(); setHeld(null); }, []);

  const value = useMemo(() => ({
    // Whether cost *could* be unlocked at all, and whether it currently is.
    canUnlock: can(CAPS.COST_VIEW),
    unlocked: Boolean(held),
    expiresAt: held?.expiresAt || null,
    prompting, setPrompting,
    unlock, lock,
    error, busy,
  }), [can, held, prompting, unlock, lock, error, busy]);

  return <CostUnlockContext.Provider value={value}>{children}</CostUnlockContext.Provider>;
}

export const useCostUnlock = () => {
  const ctx = useContext(CostUnlockContext);
  if (!ctx) throw new Error('useCostUnlock must be used inside <CostUnlockProvider>');
  return ctx;
};
