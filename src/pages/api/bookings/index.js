import { v4 as uuidv4 } from 'uuid';
import getBigQuery, { runDml } from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';
import { getUserByLarkId } from '../../../lib/users';
import { isVehicleAvailable } from '../../../lib/vehicleStatus';

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

      // Validasi waktu: parseable, start < end, tidak di masa lalu, durasi wajar.
      const startMs = Date.parse(start_time);
      const endMs = Date.parse(end_time);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return res.status(400).json({ message: 'Format waktu tidak valid.' });
      }
      if (startMs >= endMs) {
        return res.status(400).json({ message: 'Waktu mulai harus sebelum waktu selesai.' });
      }
      const GRACE_MS = 5 * 60 * 1000; // toleransi 5 menit untuk selisih jam
      if (startMs < Date.now() - GRACE_MS) {
        return res.status(400).json({ message: 'Tidak bisa membuat booking di masa lalu.' });
      }
      const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // maksimal 7 hari per booking
      if (endMs - startMs > MAX_DURATION_MS) {
        return res.status(400).json({ message: 'Durasi booking maksimal 7 hari.' });
      }

      // Kendaraan harus berstatus tersedia (Ready) — status diatur GA di menu Armada.
      const [vrows] = await bigquery.query({
        query: `SELECT status FROM \`${DATASET}.vehicles\` WHERE id = @vId`,
        params: { vId: vehicle_id },
      });
      if (vrows.length === 0) {
        return res.status(400).json({ message: 'Kendaraan tidak ditemukan.' });
      }
      if (!isVehicleAvailable(vrows[0].status)) {
        return res.status(409).json({
          message: `Kendaraan sedang tidak tersedia (status: ${vrows[0].status || 'tidak diketahui'}).`,
        });
      }

      // Approver dari struktur organisasi Lark (disinkron saat login).
      const requester = await getUserByLarkId(req.user.sub);
      if (!requester) {
        return res.status(401).json({ message: 'Profil user tidak ditemukan. Silakan login ulang.' });
      }

      const hasSupervisor = !!requester.leader_user_id;
      const initialStatus = hasSupervisor ? 'Pending Supervisor' : 'Pending GA';

      // Cek bentrok dalam satu statement INSERT ... WHERE NOT EXISTS (strict overlap;
      // booking Rejected/Cancelled diabaikan). numDmlAffectedRows = 0 → bentrok.
      // Catatan: BigQuery memakai snapshot isolation, jadi ini menutup race untuk
      // pengajuan yang tidak benar-benar bersamaan, TAPI dua INSERT yang tumpang-tindih
      // dalam window job yang sama bisa lolos keduanya (BigQuery bukan OLTP, tanpa
      // unique constraint). Untuk tool internal volume kecil + gerbang approval GA,
      // risiko ini kecil dan bisa ditangkap manual saat approval.
      const insertQuery = `
        INSERT INTO \`${DATASET}.bookings\`
          (id, vehicle_id, requester_id, user_name, user_level, requester_department,
           supervisor_id, supervisor_name,
           start_time, end_time, purpose, status, created_at)
        SELECT
          @id, @vehicle_id, @requester_id, @user_name, @user_level, @requester_department,
          @supervisor_id, @supervisor_name,
          TIMESTAMP(@start_time), TIMESTAMP(@end_time), @purpose, @status, CURRENT_TIMESTAMP()
        FROM UNNEST([1]) AS _
        WHERE NOT EXISTS (
          SELECT 1 FROM \`${DATASET}.bookings\`
          WHERE vehicle_id = @vehicle_id
            AND status NOT LIKE 'Rejected%'
            AND status NOT LIKE 'Cancelled%'
            AND start_time < TIMESTAMP(@end_time)
            AND end_time > TIMESTAMP(@start_time)
        )`;

      const affected = await runDml(insertQuery, {
        id: uuidv4(),
        vehicle_id,
        requester_id: req.user.sub,
        user_name: req.user.name,
        user_level: requester.role || req.user.role,
        requester_department: requester.department_names || '',
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
