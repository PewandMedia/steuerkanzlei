import { useEffect, useMemo, useState, useCallback, useRef } from "react";

export function usePaginatedList<T>(
  items: T[],
  pageSize: number = 10,
  resetKey?: unknown,
) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to first page on filter/search changes
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Wenn sich die Seitengröße ändert: Seite so anpassen, dass das aktuell
  // erste sichtbare Element weiterhin auf der neuen Seite sichtbar bleibt.
  const prevSize = useRef(pageSize);
  useEffect(() => {
    if (prevSize.current !== pageSize) {
      setPage((p) => Math.max(1, Math.floor(((p - 1) * prevSize.current) / pageSize) + 1));
      prevSize.current = pageSize;
    }
  }, [pageSize]);

  // Clamp page if items shrink
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visible = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const goToPage = useCallback(
    (n: number) => {
      const clamped = Math.min(Math.max(1, n), totalPages);
      setPage(clamped);
    },
    [totalPages],
  );

  const nextPage = useCallback(() => goToPage(page + 1), [goToPage, page]);
  const prevPage = useCallback(() => goToPage(page - 1), [goToPage, page]);

  return {
    visible,
    page,
    totalPages,
    total: items.length,
    shown: visible.length,
    pageSize,
    goToPage,
    nextPage,
    prevPage,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}
