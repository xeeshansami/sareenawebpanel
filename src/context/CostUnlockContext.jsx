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
  const { can, activeShopId, user } = useAuth();
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

  /**
   * The shopkeeper is exempt from the step-up, so there is nothing for them to
   * unlock.
   *
   * The server now returns cost to a Shopkeeper without a permit — they type
   * the purchase price into the product form, and asking for a password before
   * showing it back is friction with nothing behind it. Leaving the padlock in
   * the topbar would offer an action that changes nothing, which is worse than
   * not offering it: the first thing someone does with a lock that appears to
   * do nothing is assume the prices they can see are not real.
   *
   * Everyone else — a Shop User granted cost.view — keeps the prompt.
   */
  const exemptFromStepUp = user?.role === 'Shopkeeper';

  const value = useMemo(() => ({
    // Whether cost *could* be unlocked at all, and whether it currently is.
    canUnlock: can(CAPS.COST_VIEW) && !exemptFromStepUp,
    // A shopkeeper is, in effect, permanently unlocked: every response already
    // carries cost, so a page gating on this shows the number rather than ••••.
    unlocked: exemptFromStepUp || Boolean(held),
    expiresAt: held?.expiresAt || null,
    prompting, setPrompting,
    unlock, lock,
    error, busy,
  }), [can, exemptFromStepUp, held, prompting, unlock, lock, error, busy]);

  return <CostUnlockContext.Provider value={value}>{children}</CostUnlockContext.Provider>;
}

export const useCostUnlock = () => {
  const ctx = useContext(CostUnlockContext);
  if (!ctx) throw new Error('useCostUnlock must be used inside <CostUnlockProvider>');
  return ctx;
};
