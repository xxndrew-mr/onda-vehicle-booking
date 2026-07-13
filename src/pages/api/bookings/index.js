import { v4 as uuidv4 } from 'uuid';
import getBigQuery, { runDml } from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';
import { getUserByLarkId } from '../../../lib/users';

const DATASET = 'onda_booking_db';

async function handler(req, res) {
  try {
    const bigquery = getBigQuery();

    if (req.method === 'GET') {
      // Semua booking untuk kalender + info kendaraan.
      // LEFT JOIN agar booking dengan vehicle_id yatim tetap tampil (tidak "hilang").
      const query = `
        SELECT b.*,
               COALESCE(v.name, 'Kendaraan tidak dikenal') AS vehicle_name,
               v.license_plate
        FROM \`${DATASET}.bookings\` b
        LEFT JOIN \`${DATASET}.vehicles\` v ON b.vehicle_id = v.id`;

      const [rows] = await bigquery.query(query);
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { vehicle_id, start_time, end_time, purpose } = req.body || {};

      if (!vehicle_id || !start_time || !end_time || !purpose) {
        return res.status(400).json({ message: 'Semua field wajib diisi.' });
      }

      // Validasi waktu: parseable dan start < end (cegah interval terbalik lolos cek bentrok).
      const startMs = Date.parse(start_time);
      const endMs = Date.parse(end_time);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return res.status(400).json({ message: 'Format waktu tidak valid.' });
      }
      if (startMs >= endMs) {
        return res.status(400).json({ message: 'Waktu mulai harus sebelum waktu selesai.' });
      }

      // Approver dari struktur organisasi Lark (disinkron saat login).
      const requester = await getUserByLarkId(req.user.sub);
      if (!requester) {
        return res.status(401).json({ message: 'Profil user tidak ditemukan. Silakan login ulang.' });
      }

      const hasSupervisor = !!requester.leader_user_id;
      const initialStatus = hasSupervisor ? 'Pending Supervisor' : 'Pending GA';

      // Insert atomik: baris hanya masuk bila TIDAK ada booking bentrok (strict overlap,
      // booking Rejected diabaikan). numDmlAffectedRows = 0 → bentrok. Menghilangkan
      // race check-then-insert dua permintaan bersamaan.
      const insertQuery = `
        INSERT INTO \`${DATASET}.bookings\`
          (id, vehicle_id, requester_id, user_name, user_level,
           supervisor_id, supervisor_name,
           start_time, end_time, purpose, status, created_at)
        SELECT
          @id, @vehicle_id, @requester_id, @user_name, @user_level,
          @supervisor_id, @supervisor_name,
          TIMESTAMP(@start_time), TIMESTAMP(@end_time), @purpose, @status, CURRENT_TIMESTAMP()
        FROM UNNEST([1]) AS _
        WHERE NOT EXISTS (
          SELECT 1 FROM \`${DATASET}.bookings\`
          WHERE vehicle_id = @vehicle_id
            AND status NOT LIKE 'Rejected%'
            AND start_time < TIMESTAMP(@end_time)
            AND end_time > TIMESTAMP(@start_time)
        )`;

      const affected = await runDml(insertQuery, {
        id: uuidv4(),
        vehicle_id,
        requester_id: req.user.sub,
        user_name: req.user.name,
        user_level: requester.role || req.user.role,
        supervisor_id: requester.leader_user_id || '',
        supervisor_name: requester.leader_name || '',
        start_time,
        end_time,
        purpose,
        status: initialStatus,
      });

      if (affected === 0) {
        return res.status(409).json({ message: 'Mobil sudah dipesan pada jam tersebut.' });
      }

      return res.status(201).json({ message: 'Booking berhasil diajukan', status: initialStatus });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  } catch (error) {
    console.error('API /api/bookings error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
