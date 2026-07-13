import { readStateCookie, clearStateCookie } from '../../../lib/auth';
import { loginWithCode } from '../../../lib/sso';
import { safeInternalPath } from '../../../lib/redirect';

/** Callback OAuth Lark: verifikasi state (anti-CSRF) → tukar code → session. */
export default async function handler(req, res) {
  const { code, state, error } = req.query;

  const fail = (message) =>
    res.redirect(302, `/auth-error?message=${encodeURIComponent(message)}`);

  if (error === 'access_denied') {
    return fail('Anda menolak otorisasi aplikasi di Lark.');
  }

  const stateCookie = readStateCookie(req);
  clearStateCookie(res);

  if (!code || !state || !stateCookie) {
    return fail('Sesi login tidak valid atau kedaluwarsa. Silakan coba lagi.');
  }

  // Format cookie: `${nonce}|${redirectTo}` — split hanya pada `|` PERTAMA
  // agar path dengan query berisi `|` tidak terpotong.
  const sep = stateCookie.indexOf('|');
  const nonce = sep === -1 ? stateCookie : stateCookie.slice(0, sep);
  const redirectTo = safeInternalPath(sep === -1 ? '/' : stateCookie.slice(sep + 1));

  if (state !== nonce) {
    return fail('Verifikasi keamanan (state) gagal. Silakan coba login ulang.');
  }

  try {
    await loginWithCode(code, res);
  } catch (e) {
    // Detail (nama env, error BigQuery/Lark) hanya ke log server, bukan ke URL/halaman.
    console.error('API /api/auth/callback error:', e);
    return fail('Gagal menyelesaikan login. Hubungi admin bila berlanjut.');
  }

  return res.redirect(302, redirectTo);
}
