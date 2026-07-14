import { useEffect } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';

/**
 * Notifikasi melayang (fixed) yang TIDAK menggeser layout — feedback aksi.
 * Auto-hilang setelah beberapa detik. Palet: biru (sukses) · danger (error).
 */
export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  const ok = type !== 'error';

  return (
    <div className="fixed top-[5.25rem] left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md px-1">
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-[var(--radius)] border bg-[var(--paper)] shadow-[0_18px_44px_-26px_rgba(11,16,32,0.4)]"
        style={{ borderColor: ok ? 'var(--line)' : 'var(--danger-line)' }}
      >
        <span
          className="grid place-items-center w-6 h-6 rounded-full shrink-0 mt-0.5"
          style={{
            background: ok ? 'var(--blue-wash)' : 'var(--danger-wash)',
            color: ok ? 'var(--blue)' : 'var(--danger)',
          }}
        >
          {ok ? <Check size={14} /> : <AlertCircle size={14} />}
        </span>
        <span className="text-sm flex-1 text-[var(--ink)] leading-snug">{message}</span>
        <button onClick={onClose} className="shrink-0 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
