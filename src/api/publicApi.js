import axios from 'axios';
import { API_BASE_URL } from './client.js';

/**
 * The consumer end's own API client.
 *
 * A separate axios instance rather than a flag on the staff one, for the same
 * reason the backend keeps consumers in their own collection: the two must not be
 * able to borrow each other's credentials by accident. This instance knows only
 * about the consumer token, and `client.js` knows only about the staff token, so
 * a staff bearer can never travel to /public or /consumer and vice versa.
 *
 * That matters in a real situation: a shopkeeper browsing the marketplace in the
 * same browser where they are signed in to the admin panel. Both sessions are
 * live at once and neither leaks into the other.
 */

export const CONSUMER_TOKEN_KEY = 'sareena_consumer_token';
export const CONSUMER_REFRESH_KEY = 'sareena_consumer_refresh';
export const CONSUMER_KEY = 'sareena_consumer';
/** Which market the shopper is browsing. A preference, not a permission. */
export const MARKET_KEY = 'sareena_browse_market';

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export const getConsumerToken = () => localStorage.getItem(CONSUMER_TOKEN_KEY);

export function setConsumerSession({ consumer, token, refreshToken }) {
  localStorage.setItem(CONSUMER_TOKEN_KEY, token);
  localStorage.setItem(CONSUMER_REFRESH_KEY, refreshToken);
  localStorage.setItem(CONSUMER_KEY, JSON.stringify(consumer));
}

export function clearConsumerSession() {
  [CONSUMER_TOKEN_KEY, CONSUMER_REFRESH_KEY, CONSUMER_KEY].forEach((k) => localStorage.removeItem(k));
}

export function readStoredConsumer() {
  try {
    const raw = localStorage.getItem(CONSUMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const getBrowseMarket = () => localStorage.getItem(MARKET_KEY) || '';
export const setBrowseMarket = (id) => {
  if (id) localStorage.setItem(MARKET_KEY, id);
  else localStorage.removeItem(MARKET_KEY);
};

publicApi.interceptors.request.use((config) => {
  const token = getConsumerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onConsumerSignedOut = null;
export const setConsumerSignedOutHandler = (fn) => { onConsumerSignedOut = fn; };

publicApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config || {};
    const isAuthCall = String(original.url || '').includes('/consumer/login')
      || String(original.url || '').includes('/consumer/signup')
      || String(original.url || '').includes('/consumer/refresh');

    if (status === 401 && !original._retried && !isAuthCall) {
      original._retried = true;
      const refreshToken = localStorage.getItem(CONSUMER_REFRESH_KEY);
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/consumer/refresh`, { refreshToken });
          localStorage.setItem(CONSUMER_TOKEN_KEY, data.data.token);
          localStorage.setItem(CONSUMER_REFRESH_KEY, data.data.refreshToken);
          original.headers = { ...original.headers, Authorization: `Bearer ${data.data.token}` };
          return publicApi(original);
        } catch {
          // fall through to signing out
        }
      }
      clearConsumerSession();
      if (onConsumerSignedOut) onConsumerSignedOut();
    }

    if (!error.response) {
      error.friendlyMessage = `Cannot reach the shop right now. Please try again.`;
    } else if (status === 429) {
      error.friendlyMessage = error.response.data?.message || 'Too many requests — please slow down.';
    } else {
      error.friendlyMessage = error.response.data?.message || `Something went wrong (${status})`;
    }

    return Promise.reject(error);
  }
);

export const publicError = (err) =>
  err?.friendlyMessage || err?.response?.data?.message || err?.message || 'Something went wrong';

export default publicApi;
