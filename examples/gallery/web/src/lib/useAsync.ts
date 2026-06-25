import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Minimal data-fetching hook: runs `fn` on mount and when `deps` change, and
 * on explicit reload(). A generation counter ignores resolutions from
 * superseded requests, so rapid entity switches or retries can't let a stale
 * response overwrite newer data.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const run = useCallback(() => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    fn()
      .then((value) => {
        if (current === generation.current) setData(value);
      })
      .catch((e: unknown) => {
        if (current === generation.current) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    // Invalidate any in-flight request when deps change or the component unmounts.
    return () => {
      generation.current++;
    };
  }, [run]);

  return { data, error, loading, reload: run };
}
