import { useEffect, useRef } from 'react';
import { useCostUnlock } from '../context/CostUnlockContext.jsx';

/**
 * Re-runs a list's fetch when the cost unlock is gained or dropped.
 *
 * The server sends a genuinely different payload in each state — cost fields
 * are absent while locked — so cached rows would keep showing the masked
 * version after unlocking. The first run is skipped so this does not duplicate
 * the initial load.
 */
export default function useCostRefresh(reload) {
  const { canUnlock, unlocked } = useCostUnlock();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  return { canUnlock, unlocked };
}
