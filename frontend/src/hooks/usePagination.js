import { useMemo, useState } from "react";

export const usePagination = (items, pageSize = 20) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [previousItems, setPreviousItems] = useState(items);

  // Reset to page 1 whenever the items array changes meaningfully
  if (items !== previousItems) {
    setPreviousItems(items);
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    currentPage: safePage,
    totalPages,
    pageItems,
    startIndex: (safePage - 1) * pageSize + 1,
    endIndex: Math.min(safePage * pageSize, items.length),
    goToPage: setCurrentPage,
    goToNext: () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
    goToPrev: () => setCurrentPage((p) => Math.max(p - 1, 1)),
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
};
