import { useState } from 'react';

// Inisial dari nama (maks 2 huruf) untuk fallback bila foto tidak ada/gagal.
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// Warna latar fallback deterministik berdasarkan nama (konsisten per user).
const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-600', 'bg-indigo-500', 'bg-teal-600',
];
function colorFor(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/**
 * Foto profil user dari Lark (URL CDN publik). referrerPolicy="no-referrer"
 * mencegah 403 hotlink; onError → fallback inisial berwarna.
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
        className={`rounded-full object-cover shrink-0 bg-gray-200 ${className}`}
      />
    );
  }

  return (
    <span
      style={dim}
      title={name || ''}
      className={`rounded-full shrink-0 grid place-items-center text-white font-semibold ${colorFor(name)} ${className}`}
    >
      <span style={{ fontSize: Math.max(10, Math.round(size * 0.4)) }}>{initials(name)}</span>
    </span>
  );
}
