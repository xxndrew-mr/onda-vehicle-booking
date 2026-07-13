import getBigQuery, { runDml } from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';
import { getUserByLarkId } from '../../../lib/users';

const DATASET = 'onda_booking_db';

/**
 * Transisi status approval. Tahap & otorisasi ditentukan server-side dari data
 * booking + role TERKINI (dibaca ulang dari tabel users, bukan klaim JWT — supaya
 * user yang di-offboard/demote di Lark langsung kehilangan hak approval):
 *   Pending Supervisor --APPROVE--> Pending GA   (oleh supervisor ybs / ADMIN)
 *   Pending Supervisor --REJECT---> Rejected By Supervisor
 *   Pending GA         --APPROVE--> Approved     (oleh role GA / ADMIN)
 *   Pending GA         --REJECT---> Rejected By GA
 */
async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  const { action } = req.body || {}; // 'APPROVE' | 'REJECT'
  if (action !== 'APPROVE' && action !== 'REJECT') {
    return res.status(400).json({ message: 'Action tidak valid (APPROVE/REJECT).' });
  }

  try {
    const bigquery = getBigQuery();

    // Role terkini dari DB (revocation near-real-time), bukan dari JWT yang bisa basi.
    const me = await getUserByLarkId(req.user.sub);
    if (!me) {
      return res.status(401).json({ message: 'Profil user tidak ditemukan. Silakan login ulang.' });
    }
    const isAdmin = me.role === 'ADMIN';

    // Ambil booking saat ini
    const [rows] = await bigquery.query({
      query: `SELECT status, supervisor_id FROM \`${DATASET}.bookings\` WHERE id = @id`,
      params: { id },
    });

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking tidak ditemukan' });
    }

    const booking = rows[0];
    const currentStatus = booking.status;
    let nextStatus;
    let stageField; // kolom audit yang di-update

    // Otorisasi per tahap
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

    // Update dengan precondition status: hanya berhasil bila status masih sama
    // seperti yang dibaca (cegah double-approve/approve-vs-reject yang balapan).
    const updateQuery = `
      UPDATE \`${DATASET}.bookings\`
      SET status = @status,
          ${stageField}_action_by = @actor,
          ${stageField}_action_at = CURRENT_TIMESTAMP()
      WHERE id = @id AND status = @expected`;

    const affected = await runDml(updateQuery, {
      status: nextStatus,
      actor: `${me.name} (${me.lark_user_id})`,
      id,
      expected: currentStatus,
    });

    if (affected === 0) {
      return res.status(409).json({ message: 'Booking baru saja diproses orang lain. Muat ulang halaman.' });
    }

    return res.status(200).json({ message: `Status diperbarui menjadi: ${nextStatus}` });
  } catch (error) {
    console.error('API /api/bookings/[id] error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
