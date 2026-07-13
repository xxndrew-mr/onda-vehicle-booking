/**
 * Validasi target redirect internal (anti open-redirect).
 * Menolak URL absolut, protocol-relative (`//`), dan bypass backslash (`/\`)
 * yang oleh parser URL WHATWG dinormalisasi menjadi `//` sehingga mengarah ke
 * host eksternal. Hanya path internal yang boleh (harus diawali satu `/`
 * yang TIDAK diikuti `/` atau `\`). Selain itu dipaksa ke `/`.
 */
export function safeInternalPath(raw, fallback = '/') {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  if (raw.includes('\\')) return fallback;
  if (!/^\/(?![/\\])/.test(raw)) return fallback;
  return raw;
}
