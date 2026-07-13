import getBigQuery from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';

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
    const me = req.user;

    const baseSelect = `
      SELECT b.*,
             COALESCE(v.name, 'Kendaraan tidak dikenal') AS vehicle_name,
             v.license_plate
      FROM \`${DATASET}.bookings\` b
      LEFT JOIN \`${DATASET}.vehicles\` v ON b.vehicle_id = v.id`;

    const [supervisorQueue] = await bigquery.query({
      query: `${baseSelect}
        WHERE b.status = 'Pending Supervisor' AND b.supervisor_id = @me
        ORDER BY b.created_at`,
      params: { me: me.sub },
    });

    let gaQueue = [];
    if (me.role === 'GA' || me.role === 'ADMIN') {
      const [rows] = await bigquery.query(
        `${baseSelect} WHERE b.status = 'Pending GA' ORDER BY b.created_at`
      );
      gaQueue = rows;
    }

    return res.status(200).json({ supervisorQueue, gaQueue, role: me.role });
  } catch (error) {
    console.error('API /api/bookings/pending error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: error.message });
  }
}

export default requireAuth(handler);
