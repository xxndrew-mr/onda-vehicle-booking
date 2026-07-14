import { requireAuth } from '../../../lib/auth';
import { refreshSession } from '../../../lib/sso';

/**
 * Reset Session: ambil ulang data organisasi terbaru dari Lark (role, atasan,
 * departemen) untuk user yang sedang login, tanpa perlu OAuth/redirect. Session
 * cookie baru diterbitkan. Frontend cukup reload halaman setelah ini.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  try {
    const profile = await refreshSession(req.user.sub, res);
    return res.status(200).json({
      message: 'Session diperbarui.',
      user: { id: profile.lark_user_id, name: profile.name, role: profile.role },
    });
  } catch (error) {
    console.error('API /api/auth/refresh error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui session. Coba lagi.' });
  }
}

export default requireAuth(handler);
