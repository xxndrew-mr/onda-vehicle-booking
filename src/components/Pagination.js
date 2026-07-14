import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination client-side. Kembalikan potongan halaman + kontrol.
 * clampedPage menjaga halaman tetap valid saat jumlah item menyusut (mis. setelah aksi).
 */
export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = items?.length || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => (items || []).slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [items, clampedPage, pageSize]
  );
  return { pageItems, page: clampedPage, setPage, totalPages, total };
}

export default function Pagination({ page, totalPages, total, onChange }) {
  if (totalPages <= 1) return null;
  const btn =
    'inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50';
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-gray-500">
        Halaman {page} dari {totalPages} · {total} data
      </span>
      <div className="flex gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} /> Sebelumnya
        </button>
        <button className={btn} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Berikutnya <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
