import { useCallback, useEffect, useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function read(storageKey: string, fallback: PageSize): PageSize {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    const n = raw ? Number(raw) : NaN;
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
      ? (n as PageSize)
      : fallback;
  } catch {
    return fallback;
  }
}

export function usePageSize(
  storageKey: string,
  defaultSize: PageSize = 10,
): [PageSize, (n: PageSize) => void] {
  const [size, setSize] = useState<PageSize>(() => read(storageKey, defaultSize));

  useEffect(() => {
    setSize(read(storageKey, defaultSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const update = useCallback(
    (n: PageSize) => {
      setSize(n);
      try {
        window.localStorage.setItem(storageKey, String(n));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  return [size, update];
}