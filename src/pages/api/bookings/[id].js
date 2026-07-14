import getBigQuery, { runDml } from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';
import { getUserByLarkId } from '../../../lib/users';
import { isVehicleAvailable } from '../../../lib/vehicleStatus';
import { notifyTransition } from '../../../lib/notify';

const DATASET = 'onda_booking_db';

/**
 * Transisi status approval. Tahap & otorisasi ditentukan server-side dari data
 * booking + role TERKINI (dibaca ulang dari tabel users, bukan klaim JWT):
 *   Pending Supervisor --APPROVE--> Pending GA   (oleh supervisor ybs / ADMIN)
 *   Pending Supervisor --REJECT---> Rejected By Supervisor
 *   Pending GA         --APPROVE--> Approved     (oleh role GA / ADMIN)
 *   Pending GA         --REJECT---> Rejected By GA
 * CANCEL: pemohon (atau ADMIN) membatalkan booking-nya sendiri yang masih aktif
 *   (Pending Supervisor / Pending GA / Approved) --CANCEL--> Cancelled By User.
 *
 * Pergantian armada oleh GA: saat APPROVE tahap GA, GA boleh mengganti kendaraan
 * HANYA jika kendaraan yang dibooking bermasalah (status != 'Ready'), WAJIB mengisi
 * alasan, dan kendaraan pengganti harus 'Ready' + tidak bentrok di jam yang sama.
 */
async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  const { action, new_vehicle_id, reason } = req.body || {}; // APPROVE | REJECT | CANCEL
  if (!['APPROVE', 'REJECT', 'CANCEL'].includes(action)) {
    return res.status(400).json({ message: 'Action tidak valid (APPROVE/REJECT/CANCEL).' });
  }

  try {
    const bigquery = getBigQuery();

    // Role terkini dari DB (cache TTL pendek) + data booking dibaca PARALEL.
    const [me, bookingResult] = await Promise.all([
      getUserByLarkId(req.user.sub),
      bigquery.query({
        query: `SELECT b.status, b.supervisor_id, b.requester_id, b.vehicle_id,
                       b.start_time, b.end_time, b.user_name, b.requester_department,
                       COALESCE(v.name, 'Kendaraan') AS vehicle_name
                FROM \`${DATASET}.bookings\` b
                LEFT JOIN \`${DATASET}.vehicles\` v ON b.vehicle_id = v.id
                WHERE b.id = @id`,
        params: { id },
      }),
    ]);

    if (!me) {
      return res.status(401).json({ message: 'Profil user tidak ditemukan. Silakan login ulang.' });
    }
    const isAdmin = me.role === 'ADMIN';
    const actor = `${me.name} (${me.lark_user_id})`;
    const rows = bookingResult[0];

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking tidak ditemukan' });
    }

    const booking = rows[0];
    const currentStatus = booking.status;

    // --- Pembatalan oleh pemohon (atau ADMIN) ---
    if (action === 'CANCEL') {
      const isOwner = booking.requester_id && booking.requester_id === me.lark_user_id;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Hanya pemohon yang bisa membatalkan booking ini.' });
      }
      if (!['Pending Supervisor', 'Pending GA', 'Approved'].includes(currentStatus)) {
        return res.status(409).json({ message: `Booking tidak bisa dibatalkan (status: ${currentStatus}).` });
      }
      const affected = await runDml(
        `UPDATE \`${DATASET}.bookings\` SET status = 'Cancelled By User'
         WHERE id = @id AND status = @expected`,
        { id, expected: currentStatus }
      );
      if (affected === 0) {
        return res.status(409).json({ message: 'Booking baru saja berubah. Muat ulang halaman.' });
      }
      return res.status(200).json({ message: 'Booking dibatalkan.' });
    }

    // --- Tahap GA: APPROVE (opsional dengan pergantian armada) ---
    if (currentStatus === 'Pending GA' && action === 'APPROVE') {
      if (me.role !== 'GA' && !isAdmin) {
        return res.status(403).json({ message: 'Hanya tim GA yang bisa memproses tahap ini.' });
      }

      const wantsSwap = new_vehicle_id && new_vehicle_id !== booking.vehicle_id;

      if (wantsSwap) {
        // Alasan pergantian WAJIB (cek murah dulu sebelum query).
        if (!reason || !String(reason).trim()) {
          return res.status(400).json({ message: 'Alasan pergantian kendaraan wajib diisi.' });
        }

        // Tiga validasi query dijalankan PARALEL: status kendaraan asli,
        // status kendaraan pengganti, dan cek bentrok pengganti.
        const [[cur], [nv], [conf]] = await Promise.all([
          bigquery.query({
            query: `SELECT status FROM \`${DATASET}.vehicles\` WHERE id = @vId`,
            params: { vId: booking.vehicle_id },
          }),
          bigquery.query({
            query: `SELECT status, name FROM \`${DATASET}.vehicles\` WHERE id = @vId`,
            params: { vId: new_vehicle_id },
          }),
          bigquery.query({
            query: `SELECT id FROM \`${DATASET}.bookings\`
                    WHERE vehicle_id = @nv AND id != @id
                      AND status NOT LIKE 'Rejected%' AND status NOT LIKE 'Cancelled%'
                      AND start_time < TIMESTAMP(@end) AND end_time > TIMESTAMP(@start)`,
            params: {
              nv: new_vehicle_id,
              id,
              start: booking.start_time.value,
              end: booking.end_time.value,
            },
          }),
        ]);

        // 1. Hanya boleh ganti bila kendaraan asli BERMASALAH (status != Ready).
        if (cur.length > 0 && isVehicleAvailable(cur[0].status)) {
          return res.status(400).json({
            message: 'Kendaraan yang diajukan tidak bermasalah — tidak boleh diganti. Ubah status kendaraan di menu Armada bila memang ada kendala.',
          });
        }
        // 2. Kendaraan pengganti harus ada dan 'Ready'.
        if (nv.length === 0) {
          return res.status(400).json({ message: 'Kendaraan pengganti tidak ditemukan.' });
        }
        if (!isVehicleAvailable(nv[0].status)) {
          return res.status(409).json({ message: 'Kendaraan pengganti sedang tidak tersedia.' });
        }
        // 3. Kendaraan pengganti tidak boleh bentrok di jendela waktu booking.
        if (conf.length > 0) {
          return res.status(409).json({ message: 'Kendaraan pengganti sudah dipesan pada jam tersebut.' });
        }

        // 5. Simpan: ganti armada + approve, dengan precondition status.
        const affected = await runDml(
          `UPDATE \`${DATASET}.bookings\`
           SET status = 'Approved',
               vehicle_id = @newV,
               original_vehicle_id = @oldV,
               vehicle_change_reason = @reason,
               vehicle_change_by = @actor,
               vehicle_change_at = CURRENT_TIMESTAMP(),
               ga_action_by = @actor,
               ga_action_at = CURRENT_TIMESTAMP()
           WHERE id = @id AND status = @expected`,
          {
            newV: new_vehicle_id,
            oldV: booking.vehicle_id,
            reason: String(reason).trim(),
            actor,
            id,
            expected: currentStatus,
          }
        );
        if (affected === 0) {
          return res.status(409).json({ message: 'Booking baru saja diproses orang lain. Muat ulang halaman.' });
        }
        // Notif ke pemohon: disetujui dengan kendaraan pengganti.
        try {
          await notifyTransition({ ...booking, vehicle_name: nv[0].name || booking.vehicle_name }, 'Approved');
        } catch (e) {
          console.error('[notify] approve+swap:', e.message);
        }
        return res.status(200).json({ message: 'Disetujui dengan pergantian kendaraan.' });
      }
      // APPROVE GA tanpa pergantian → jatuh ke alur generik di bawah.
    }

    // --- Alur transisi generik (supervisor + GA tanpa swap + semua REJECT) ---
    let nextStatus;
    let stageField;

    if (currentStatus === 'Pending Supervisor') {
      const isTheSupervisor = booking.supervisor_id && booking.supervisor_id === me.lark_user_id;
      if (!isTheSupervisor && !isAdmin) {
        return res.status(403).json({
          message: 'Hanya supervisor pemohon (sesuai struktur Lark) yang bisa memproses tahap ini.',
        });
      }
      nextStatus = action === 'APPROVE' ? 'Pending GA' : 'Rejected By Supervisor';
      stageField = 'supervisor';
    } else if (currentStatus === 'Pending GA') {
      if (me.role !== 'GA' && !isAdmin) {
        return res.status(403).json({ message: 'Hanya tim GA yang bisa memproses tahap ini.' });
      }
      nextStatus = action === 'APPROVE' ? 'Approved' : 'Rejected By GA';
      stageField = 'ga';
    } else {
      return res.status(409).json({
        message: `Booking sudah tidak dalam tahap persetujuan (status saat ini: ${currentStatus}).`,
      });
    }

    const affected = await runDml(
      `UPDATE \`${DATASET}.bookings\`
       SET status = @status,
           ${stageField}_action_by = @actor,
           ${stageField}_action_at = CURRENT_TIMESTAMP()
       WHERE id = @id AND status = @expected`,
      { status: nextStatus, actor, id, expected: currentStatus }
    );

    if (affected === 0) {
      return res.status(409).json({ message: 'Booking baru saja diproses orang lain. Muat ulang halaman.' });
    }

    // Notifikasi bot: tahap berikutnya (GA) atau hasil akhir ke pemohon.
    try {
      await notifyTransition(booking, nextStatus);
    } catch (e) {
      console.error('[notify] transisi:', e.message);
    }

    return res.status(200).json({ message: `Status diperbarui menjadi: ${nextStatus}` });
  } catch (error) {
    console.error('API /api/bookings/[id] error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
