import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import type { ApiResult } from "./api";

/**
 * Charge des données à l'affichage de l'écran (et à chaque retour sur
 * celui-ci) ; `refresh` sert au geste « tirer pour actualiser ».
 */
export function useLoad<T>(loader: () => Promise<ApiResult<T>>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(loader);
  latest.current = loader;

  const run = useCallback(async () => {
    const result = await latest.current();
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.code);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  }, [run]);

  return { data, error, refreshing, refresh, reload: run, setData };
}

/** Combine plusieurs appels : tout réussit, ou la première erreur. */
export async function all<T extends readonly unknown[]>(
  calls: {
    [K in keyof T]: Promise<ApiResult<T[K]>>;
  },
): Promise<ApiResult<T>>;
export async function all(
  calls: readonly Promise<ApiResult<unknown>>[],
): Promise<ApiResult<unknown[]>> {
  const results = await Promise.all(calls);
  const data: unknown[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    data.push(r.data);
  }
  return { ok: true, data };
}
