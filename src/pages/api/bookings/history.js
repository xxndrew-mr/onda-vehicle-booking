import getBigQuery from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';
import { getUserByLarkId } from '../../../lib/users';

const DATASET = 'onda_booking_db';

/**
 * Riwayat booking untuk halaman /riwayat:
 * - mine      : semua booking yang diajukan user login (semua status), terbaru dulu.
 * - processed : riwayat persetujuan — booking yang pernah DIPROSES user ini sebagai
 *               supervisor/GA (dicari dari kolom audit *_action_by yang berformat
 *               "Nama (open_id)"). ADMIN melihat seluruh riwayat persetujuan.
 *               Hanya diisi untuk supervisor/GA/ADMIN.
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  try {
    const bigquery = getBigQuery();

    const me = await getUserByLarkId(req.user.sub);
    if (!me) {
      return res.status(401).json({ message: 'Profil user tidak ditemukan. Silakan login ulang.' });
    }

    const isAdmin = me.role === 'ADMIN';
    const canApprove = isAdmin || me.role === 'GA' || !!me.is_supervisor;

    const baseSelect = `
      SELECT b.*,
             COALESCE(v.name, 'Kendaraan tidak dikenal') AS vehicle_name,
             v.license_plate
      FROM \`${DATASET}.bookings\` b
      LEFT JOIN \`${DATASET}.vehicles\` v ON b.vehicle_id = v.id`;

    const [mine] = await bigquery.query({
      query: `${baseSelect}
        WHERE b.requester_id = @me
        ORDER BY b.created_at DESC`,
      params: { me: me.lark_user_id },
    });

    let processed = [];
    if (canApprove) {
      if (isAdmin) {
        const [rows] = await bigquery.query(
          `${baseSelect}
           WHERE b.supervisor_action_at IS NOT NULL OR b.ga_action_at IS NOT NULL
           ORDER BY COALESCE(b.ga_action_at, b.supervisor_action_at) DESC`
        );
        processed = rows;
      } else {
        const [rows] = await bigquery.query({
          query: `${baseSelect}
            WHERE STRPOS(IFNULL(b.supervisor_action_by, ''), @me) > 0
               OR STRPOS(IFNULL(b.ga_action_by, ''), @me) > 0
            ORDER BY COALESCE(b.ga_action_at, b.supervisor_action_at) DESC`,
          params: { me: me.lark_user_id },
        });
        processed = rows;
      }
    }

    return res.status(200).json({ mine, processed, canApprove, isAdmin, role: me.role });
  } catch (error) {
    console.error('API /api/bookings/history error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
