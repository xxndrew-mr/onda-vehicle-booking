import getBigQuery from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';

const DATASET = 'onda_booking_db';

/**
 * Antrian persetujuan milik user yang sedang login:
 * - supervisorQueue: booking 'Pending Supervisor' yang supervisor-nya = saya.
 * - gaQueue: semua booking 'Pending GA' — hanya untuk role GA/ADMIN.
 *
 * Endpoint READ → pakai role dari JWT (req.user) tanpa query users tambahan.
 * Enforcement sebenarnya tetap di aksi approval (api/bookings/[id].js) yang
 * membaca role terkini dari DB, jadi tampilan antrian yang sedikit basi aman.
 * Kedua query dijalankan paralel untuk menekan latensi BigQuery.
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  try {
    const bigquery = getBigQuery();
    const me = req.user; // { sub, role, is_supervisor, ... }
    const isAdmin = me.role === 'ADMIN';
    const isGa = me.role === 'GA' || isAdmin;

    const baseSelect = `
      SELECT b.*,
             COALESCE(v.name, 'Kendaraan tidak dikenal') AS vehicle_name,
             v.license_plate,
             v.status AS vehicle_status,
             u.avatar_url AS requester_avatar
      FROM \`${DATASET}.bookings\` b
      LEFT JOIN \`${DATASET}.vehicles\` v ON b.vehicle_id = v.id
      LEFT JOIN \`${DATASET}.users\` u ON b.requester_id = u.lark_user_id`;

    // supervisorQueue: ADMIN melihat SEMUA tahap supervisor; user lain hanya miliknya.
    const supervisorPromise = isAdmin
      ? bigquery.query(`${baseSelect} WHERE b.status = 'Pending Supervisor' ORDER BY b.created_at`)
      : bigquery.query({
          query: `${baseSelect}
            WHERE b.status = 'Pending Supervisor' AND b.supervisor_id = @me
            ORDER BY b.created_at`,
          params: { me: me.sub },
        });

    // gaQueue: semua tahap GA — hanya GA/ADMIN.
    const gaPromise = isGa
      ? bigquery.query(`${baseSelect} WHERE b.status = 'Pending GA' ORDER BY b.created_at`)
      : Promise.resolve([[]]);

    const [[supervisorQueue], [gaQueue]] = await Promise.all([supervisorPromise, gaPromise]);

    return res.status(200).json({
      supervisorQueue,
      gaQueue,
      role: me.role,
      isAdmin,
      is_supervisor: !!me.is_supervisor,
    });
  } catch (error) {
    console.error('API /api/bookings/pending error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
