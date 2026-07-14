import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

/**
 * Notifikasi melayang (fixed) yang TIDAK menggeser layout — dipakai untuk
 * feedback aksi (approve/reject/ubah status/batal) agar konten tidak "loncat".
 * Auto-hilang setelah beberapa detik.
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
    <div className="fixed top-[4.75rem] left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md px-1">
      <div
        className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg border ${
          ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'
        }`}
      >
        {ok ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
        <span className="text-sm flex-1">{message}</span>
        <button onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
