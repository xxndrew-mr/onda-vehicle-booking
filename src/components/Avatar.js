import { useState } from 'react';

// Inisial dari nama (maks 2 huruf) untuk fallback bila foto tidak ada/gagal.
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/**
 * Foto profil user dari Lark (URL CDN publik). referrerPolicy="no-referrer"
 * mencegah 403 hotlink; onError → fallback inisial monokrom (Space Mono).
 */
export default function Avatar({ src, name, size = 32, className = '' }) {
  const [err, setErr] = useState(false);
  const dim = { width: size, height: size };

  if (src && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || 'avatar'}
        referrerPolicy="no-referrer"
        onError={() => setErr(true)}
        style={dim}
        className={`rounded-full object-cover shrink-0 bg-[var(--mist)] ${className}`}
      />
    );
  }

  return (
    <span
      style={dim}
      title={name || ''}
      className={`rounded-full shrink-0 grid place-items-center border border-[var(--line)] bg-[var(--mist)] text-[var(--ink-2)] ${className}`}
    >
      <span className="mono font-bold" style={{ fontSize: Math.max(9, Math.round(size * 0.36)) }}>
        {initials(name)}
      </span>
    </span>
  );
}
