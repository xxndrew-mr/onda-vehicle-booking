import { clearSessionCookie } from '../../../lib/auth';

/**
 * Hapus session aplikasi (login Lark di perangkat user tidak tersentuh).
 * Navbar memanggil ini lalu mengarahkan ke halaman publik /keluar (bukan '/',
 * yang di dalam Lark akan auto-login lagi). Tombol Keluar juga memunculkan
 * konfirmasi seketika supaya user langsung dapat feedback.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  clearSessionCookie(res);
  return res.status(200).json({ message: 'Session dihapus.' });
}
