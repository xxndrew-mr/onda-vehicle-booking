import { randomUUID } from 'crypto';
import { buildAuthorizeUrl } from '../../../lib/lark';
import { setStateCookie } from '../../../lib/auth';
import { loginWithCode } from '../../../lib/sso';
import { safeInternalPath } from '../../../lib/redirect';

/**
 * GET  — mulai SSO: redirect ke halaman otorisasi Lark. Di dalam klien Lark
 *        redirect ini auto-approve (tanpa layar konfirmasi) sehingga user
 *        langsung kembali ke aplikasi dalam keadaan login.
 * POST — jalur alternatif untuk JSAPI (tt.requestAccess di dalam Lark):
 *        body { code } → session cookie, tanpa redirect. Dibatasi same-origin
 *        (cek Sec-Fetch-Site/Origin) untuk mencegah login-CSRF/session fixation.
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const redirectTo = safeInternalPath(req.query.redirect_to);
      const nonce = randomUUID();
      setStateCookie(res, `${nonce}|${redirectTo}`);
      return res.redirect(302, buildAuthorizeUrl(nonce));
    } catch (error) {
      // GET dipicu oleh navigasi browser (redirect proxy) → tampilkan halaman error, bukan JSON.
      console.error('API /api/auth/login GET error:', error);
      return res.redirect(302, `/auth-error?message=${encodeURIComponent(error.message)}`);
    }
  }

  if (req.method === 'POST') {
    // Tolak POST lintas-situs: hanya boleh dari halaman aplikasi sendiri.
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'same-site') {
      return res.status(403).json({ message: 'Permintaan lintas-situs ditolak.' });
    }
    // Origin dibandingkan PERSIS (scheme+host+port) — startsWith bisa dilewati
    // host mirip (mis. "https://app.example.com.evil.test"). new URL().origin
    // juga menormalkan trailing slash pada APP_BASE_URL.
    const origin = req.headers.origin;
    if (origin && process.env.APP_BASE_URL) {
      let allowedOrigin = null;
      try {
        allowedOrigin = new URL(process.env.APP_BASE_URL).origin;
      } catch {
        allowedOrigin = null;
      }
      if (!allowedOrigin || origin !== allowedOrigin) {
        return res.status(403).json({ message: 'Origin tidak diizinkan.' });
      }
    }

    try {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ message: 'Authorization code wajib diisi.' });

      const profile = await loginWithCode(code, res);
      return res.status(200).json({
        message: 'Login berhasil',
        user: { id: profile.lark_user_id, name: profile.name, role: profile.role },
      });
    } catch (error) {
      console.error('API /api/auth/login POST error:', error);
      return res.status(500).json({ message: 'Gagal login lewat Lark. Silakan coba lagi.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
}
