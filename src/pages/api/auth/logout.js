import { clearSessionCookie } from '../../../lib/auth';

/** Hapus session aplikasi (utility; login Lark di perangkat user tidak tersentuh). */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  clearSessionCookie(res);
  return res.status(200).json({ message: 'Session dihapus.' });
}
