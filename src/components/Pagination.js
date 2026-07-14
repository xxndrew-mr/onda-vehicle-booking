import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * Pagination client-side. Kembalikan potongan halaman + kontrol.
 * clampedPage menjaga halaman tetap valid saat jumlah item menyusut.
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
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--line)] mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--line)] disabled:hover:text-[var(--ink-2)]';
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--line)]">
      <span className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
        Hal {page}/{totalPages} · {total} data
      </span>
      <div className="flex gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ArrowLeft size={14} /> Prev
        </button>
        <button className={btn} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
