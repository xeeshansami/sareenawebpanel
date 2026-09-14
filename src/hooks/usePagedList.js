import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';

/**
 * Fetches a paginated list endpoint and keeps page/search state.
 * Backend contract: { success, data: [...], pagination: {...} }
 */
export default function usePagedList(path, { limit = 20, params = {}, config = {} } = {}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const extraKey = JSON.stringify(params);
  const configKey = JSON.stringify(config);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(path, {
        ...config,
        params: { page, limit, ...(debounced ? { search: debounced } : {}), ...params },
      });
      setItems(data.data || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(errorMessage(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, limit, debounced, extraKey, configKey]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    items, pagination, page, setPage,
    search, setSearch,
    loading, error,
    reload: load,
  };
}
