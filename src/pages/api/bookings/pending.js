import getBigQuery from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';
import { getUserByLarkId } from '../../../lib/users';

const DATASET = 'onda_booking_db';

/**
 * Antrian persetujuan milik user yang sedang login:
 * - supervisorQueue: booking 'Pending Supervisor' yang supervisor-nya = saya
 *   (penugasan otomatis dari leader_user_id di struktur Lark).
 * - gaQueue: semua booking 'Pending GA' — hanya untuk role GA/ADMIN.
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  try {
    const bigquery = getBigQuery();

    // Role terkini dari DB (bukan klaim JWT yang bisa basi) — konsisten dengan
    // otorisasi aksi approval, sehingga user yang di-demote di Lark langsung
    // kehilangan akses antrian GA.
    const me = await getUserByLarkId(req.user.sub);
    if (!me) {
      return res.status(401).json({ message: 'Profil user tidak ditemukan. Silakan login ulang.' });
    }

    const baseSelect = `
      SELECT b.*,
             COALESCE(v.name, 'Kendaraan tidak dikenal') AS vehicle_name,
             v.license_plate,
             v.status AS vehicle_status
      FROM \`${DATASET}.bookings\` b
      LEFT JOIN \`${DATASET}.vehicles\` v ON b.vehicle_id = v.id`;

    const isAdmin = me.role === 'ADMIN';

    // supervisorQueue: ADMIN melihat SEMUA pengajuan tahap supervisor (boleh bertindak
    // sebagai supervisor mana pun); user lain hanya yang dirinya jadi supervisor.
    let supervisorQueue;
    if (isAdmin) {
      [supervisorQueue] = await bigquery.query(
        `${baseSelect} WHERE b.status = 'Pending Supervisor' ORDER BY b.created_at`
      );
    } else {
      [supervisorQueue] = await bigquery.query({
        query: `${baseSelect}
          WHERE b.status = 'Pending Supervisor' AND b.supervisor_id = @me
          ORDER BY b.created_at`,
        params: { me: me.lark_user_id },
      });
    }

    // gaQueue: semua pengajuan tahap GA — untuk role GA dan ADMIN.
    let gaQueue = [];
    if (me.role === 'GA' || isAdmin) {
      const [rows] = await bigquery.query(
        `${baseSelect} WHERE b.status = 'Pending GA' ORDER BY b.created_at`
      );
      gaQueue = rows;
    }

    return res.status(200).json({ supervisorQueue, gaQueue, role: me.role, isAdmin });
  } catch (error) {
    console.error('API /api/bookings/pending error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
