import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sareenanodeserver.vercel.app/api/v1';

export const TOKEN_KEY = 'sareena_token';
export const REFRESH_KEY = 'sareena_refresh_token';
export const USER_KEY = 'sareena_user';
export const ACTIVE_SHOP_KEY = 'sareena_active_shop';
export const COST_UNLOCK_KEY = 'sareena_cost_unlock';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Super Admin works one shop at a time. The chosen shop travels as a header
 * on every request; the backend still decides what that means, and ignores it
 * entirely for shop-bound users. Clearing it means "all shops".
 */
export const getActiveShop = () => localStorage.getItem(ACTIVE_SHOP_KEY) || null;
export const setActiveShop = (shopId) => {
  if (shopId) localStorage.setItem(ACTIVE_SHOP_KEY, shopId);
  else localStorage.removeItem(ACTIVE_SHOP_KEY);
};

/**
 * Cost prices are released only after a step-up password check, and only for
 * the shop the unlock was earned for. The token is short lived and kept in
 * sessionStorage rather than localStorage so closing the tab re-locks — a
 * shared counter machine should not stay unlocked overnight.
 */
export function getCostUnlock() {
  try {
    const raw = sessionStorage.getItem(COST_UNLOCK_KEY);
    if (!raw) return null;
    const held = JSON.parse(raw);
    if (new Date(held.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(COST_UNLOCK_KEY);
      return null;
    }
    // An unlock earned for another shop must not apply here.
    if (String(held.shopId || '') !== String(getActiveShop() || '')) return null;
    return held;
  } catch {
    return null;
  }
}

export function setCostUnlock(held) {
  try {
    if (held) sessionStorage.setItem(COST_UNLOCK_KEY, JSON.stringify(held));
    else sessionStorage.removeItem(COST_UNLOCK_KEY);
  } catch {
    // sessionStorage can throw in private mode; the app still works locked
  }
}

export const clearCostUnlock = () => setCostUnlock(null);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // A caller that set the header itself wins — see PLATFORM_SCOPE below.
  const shopId = getActiveShop();
  if (shopId && !config.headers['X-Shop-Id']) config.headers['X-Shop-Id'] = shopId;

  const unlock = getCostUnlock();
  if (unlock) config.headers['X-Cost-Unlock'] = unlock.token;

  return config;
});

/**
 * For platform-level reads that must not be narrowed to the shop a Super Admin
 * happens to be working inside.
 *
 * Markets sit above shops, so listing them while a shop is selected would
 * otherwise return that shop's market alone — and the shop form's market
 * dropdown would offer exactly one choice. `all` is the value resolveScope
 * already understands as "do not narrow".
 *
 *   api.get('/markets', { ...PLATFORM_SCOPE, params: { limit: 100 } })
 */
export const PLATFORM_SCOPE = { headers: { 'X-Shop-Id': 'all' } };

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config || {};

    if (status === 401 && !original._retried && !String(original.url || '').includes('/auth/')) {
      original._retried = true;
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem(TOKEN_KEY, data.data.token);
          localStorage.setItem(REFRESH_KEY, data.data.refreshToken);
          original.headers = { ...original.headers, Authorization: `Bearer ${data.data.token}` };
          return api(original);
        } catch {
          // fall through to sign-out
        }
      }
      [TOKEN_KEY, REFRESH_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k));
      clearCostUnlock();
      if (onUnauthorized) onUnauthorized();
    }

    if (!error.response) {
      error.friendlyMessage = `Cannot reach the API at ${API_BASE_URL}. Is the backend running?`;
    } else if (status === 428) {
      // The dedicated cost endpoint asking for a step-up. Not an error the
      // user needs to see — the caller prompts for a password instead.
      error.needsCostUnlock = true;
      error.friendlyMessage = error.response.data?.message || 'Password required.';
    } else if (status === 403) {
      error.friendlyMessage = error.response.data?.message || 'You do not have permission for that.';
    } else {
      error.friendlyMessage = error.response.data?.message || `Request failed (${status})`;
    }

    return Promise.reject(error);
  }
);

export const errorMessage = (err) =>
  err?.friendlyMessage || err?.response?.data?.message || err?.message || 'Something went wrong';

/** Capability names, mirrored from the backend so the UI can gate on them. */
export const CAPS = {
  // Platform — Super Admin only
  MARKET_MANAGE: 'market.manage', MARKET_VIEW_ALL: 'market.viewAll',
  SHOP_VIEW_ALL: 'shop.viewAll', AUDIT_VIEW: 'audit.view',
  USER_APPROVE: 'user.approve',
  SETTINGS_GLOBAL: 'settings.global',
  // Market
  SHOP_MANAGE: 'shop.manage', MARKET_REPORT: 'market.report',
  // Shop
  USER_MANAGE: 'user.manage', SETTINGS_MANAGE: 'settings.manage',
  PRODUCT_VIEW: 'product.view', PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update', PRODUCT_DELETE: 'product.delete',
  PRODUCT_PUBLISH: 'product.publish',
  ORDER_VIEW: 'order.view', ORDER_FULFIL: 'order.fulfil',
  INVENTORY_VIEW: 'inventory.view', INVENTORY_ADJUST: 'inventory.adjust',
  PURCHASE_VIEW: 'purchase.view', PURCHASE_CREATE: 'purchase.create', PURCHASE_PAY: 'purchase.pay',
  SALE_VIEW: 'sale.view', SALE_CREATE: 'sale.create', SALE_PAY: 'sale.pay', SALE_CANCEL: 'sale.cancel',
  CUSTOMER_VIEW: 'customer.view', CUSTOMER_MANAGE: 'customer.manage',
  SUPPLIER_VIEW: 'supplier.view', SUPPLIER_MANAGE: 'supplier.manage',
  LEDGER_VIEW: 'ledger.view', COST_VIEW: 'cost.view',
  EXPENSE_VIEW: 'expense.view', EXPENSE_MANAGE: 'expense.manage',
  REPORT_VIEW: 'report.view', REPORT_PROFIT: 'report.profit',
  OCR_USE: 'ocr.use', EXPORT_CSV: 'export.csv', BACKUP_RUN: 'backup.run',
};

export default api;
