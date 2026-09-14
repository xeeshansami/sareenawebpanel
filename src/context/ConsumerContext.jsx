import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import publicApi, {
  CONSUMER_TOKEN_KEY, clearConsumerSession, readStoredConsumer, setConsumerSession,
  setConsumerSignedOutHandler, publicError, getBrowseMarket, setBrowseMarket,
} from '../api/publicApi.js';

const ConsumerContext = createContext(null);

/**
 * The shopper's session and cart.
 *
 * Entirely separate from AuthContext. Both can be signed in at once in one
 * browser — a shopkeeper looking at their own storefront — and neither knows
 * about the other.
 *
 * Carts live on the server, one per shop, because a basket that vanishes when
 * you switch from your phone to a laptop is not a basket. They are only fetched
 * when signed in; browsing needs no account (§9).
 */
export function ConsumerProvider({ children }) {
  const [consumer, setConsumer] = useState(readStoredConsumer);
  const [booting, setBooting] = useState(Boolean(localStorage.getItem(CONSUMER_TOKEN_KEY)));
  const [carts, setCarts] = useState([]);
  const [marketId, setMarketIdState] = useState(getBrowseMarket);

  const chooseMarket = useCallback((id) => {
    setBrowseMarket(id);
    setMarketIdState(id || '');
  }, []);

  const refreshCarts = useCallback(async () => {
    if (!localStorage.getItem(CONSUMER_TOKEN_KEY)) { setCarts([]); return; }
    try {
      const { data } = await publicApi.get('/consumer/carts');
      setCarts(data.data || []);
    } catch {
      // A failed cart read must not break browsing.
    }
  }, []);

  useEffect(() => {
    setConsumerSignedOutHandler(() => { setConsumer(null); setCarts([]); });
  }, []);

  // Revalidate a stored session rather than trusting it: a disabled account
  // must not appear signed in.
  useEffect(() => {
    let cancelled = false;
    if (!localStorage.getItem(CONSUMER_TOKEN_KEY)) { setBooting(false); return undefined; }
    (async () => {
      try {
        const { data } = await publicApi.get('/consumer/me');
        if (cancelled) return;
        setConsumer(data.data);
        await refreshCarts();
      } catch {
        if (!cancelled) { clearConsumerSession(); setConsumer(null); }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshCarts]);

  const signIn = useCallback(async (email, password) => {
    const { data } = await publicApi.post('/consumer/login', { email, password });
    setConsumerSession({
      consumer: data.data.consumer,
      token: data.data.token,
      refreshToken: data.data.refreshToken,
    });
    setConsumer(data.data.consumer);
    await refreshCarts();
    return data.data.consumer;
  }, [refreshCarts]);

  const signUp = useCallback(async (fields) => {
    const { data } = await publicApi.post('/consumer/signup', fields);
    setConsumerSession({
      consumer: data.data.consumer,
      token: data.data.token,
      refreshToken: data.data.refreshToken,
    });
    setConsumer(data.data.consumer);
    return data.data.consumer;
  }, []);

  const signOut = useCallback(() => {
    clearConsumerSession();
    setConsumer(null);
    setCarts([]);
  }, []);

  /**
   * Adds or changes one line. The shop is decided by the product on the server,
   * so the caller never has to know which cart it lands in.
   */
  const setCartQuantity = useCallback(async (productId, quantity) => {
    const { data } = await publicApi.post('/consumer/carts/items', { productId, quantity });
    await refreshCarts();
    return data.data;
  }, [refreshCarts]);

  const clearCart = useCallback(async (shopId) => {
    await publicApi.delete(`/consumer/carts/${shopId}`);
    await refreshCarts();
  }, [refreshCarts]);

  const value = useMemo(() => {
    const totalItems = carts.reduce((sum, c) => sum + (c.itemCount || 0), 0);
    return {
      consumer,
      booting,
      isSignedIn: Boolean(consumer),
      carts,
      totalItems,
      cartForShop: (shopId) => carts.find((c) => String(c.shop?.id) === String(shopId)) || null,
      quantityOf: (productId) => {
        for (const cart of carts) {
          const line = cart.items?.find((l) => String(l.productId) === String(productId));
          if (line) return line.quantity;
        }
        return 0;
      },
      marketId,
      chooseMarket,
      signIn, signUp, signOut,
      setCartQuantity, clearCart, refreshCarts,
    };
  }, [consumer, booting, carts, marketId, chooseMarket, signIn, signUp, signOut, setCartQuantity, clearCart, refreshCarts]);

  return <ConsumerContext.Provider value={value}>{children}</ConsumerContext.Provider>;
}

export const useConsumer = () => {
  const ctx = useContext(ConsumerContext);
  if (!ctx) throw new Error('useConsumer must be used inside <ConsumerProvider>');
  return ctx;
};

export { publicError };
