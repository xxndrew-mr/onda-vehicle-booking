import { sendLarkMessage } from './lark';
import getBigQuery from './bigquery';

const DATASET = 'onda_booking_db';

function appUrl(path = '') {
  const base = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}${path}` : '';
}

// Notifikasi dikirim dari SERVER (Vercel = UTC). Timestamp BigQuery tersimpan UTC,
// jadi WAJIB format eksplisit ke zona WIB — tanpa ini jam tampil geser -7 jam
// (mis. booking 12:00 WIB tercetak 05:00). WIB = Asia/Jakarta.
const TZ = 'Asia/Jakarta';

// Terima string ISO ataupun objek BigQuery { value }.
function fmtTime(x) {
  const v = typeof x === 'string' ? x : x?.value;
  if (!v) return '-';
  return new Date(v).toLocaleString('id-ID', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
const fmtRange = (s, e) => `${fmtTime(s)} s/d ${fmtTime(e)} WIB`;

// Kirim ke banyak open_id; kegagalan notifikasi TIDAK boleh mengganggu alur utama.
async function safeSend(openIds, text) {
  const targets = [...new Set((openIds || []).filter(Boolean))];
  await Promise.all(
    targets.map((id) =>
      sendLarkMessage(id, text).catch((e) => console.error('[notify] gagal ke', id, e.message))
    )
  );
}

// open_id approver tahap GA: role GA + ADMIN (admin juga bisa memproses tahap GA,
// jadi ikut diberi notifikasi).
async function gaApproverOpenIds() {
  try {
    const bigquery = getBigQuery();
    const [rows] = await bigquery.query(
      `SELECT lark_user_id FROM \`${DATASET}.users\` WHERE role IN ('GA', 'ADMIN')`
    );
    return rows.map((r) => r.lark_user_id).filter(Boolean);
  } catch (e) {
    console.error('[notify] gagal ambil daftar approver GA:', e.message);
    return [];
  }
}

const bookingLines = (b) =>
  `Pemohon: ${b.user_name}${b.requester_department ? ` (${b.requester_department})` : ''}\n` +
  `Kendaraan: ${b.vehicle_name}\n` +
  `Waktu: ${fmtRange(b.start_time, b.end_time)}\n` +
  `Keperluan: ${b.purpose || '-'}`;

/** Notifikasi saat booking baru dibuat. */
export async function notifyBookingCreated(b) {
  if (b.status === 'Pending Supervisor' && b.supervisor_id) {
    await safeSend(
      [b.supervisor_id],
      `🚗 Booking baru menunggu persetujuan Anda (Supervisor)\n\n${bookingLines(b)}\n\nBuka: ${appUrl('/approval')}`
    );
  } else if (b.status === 'Pending GA') {
    await safeSend(
      await gaApproverOpenIds(),
      `🚗 Booking menunggu persetujuan GA\n\n${bookingLines(b)}\n\nBuka: ${appUrl('/approval')}`
    );
  }
}

/** Notifikasi setelah transisi approval. */
export async function notifyTransition(b, nextStatus) {
  const info = `Kendaraan: ${b.vehicle_name}\nWaktu: ${fmtRange(b.start_time, b.end_time)}`;
  switch (nextStatus) {
    case 'Pending GA':
      await safeSend(
        await gaApproverOpenIds(),
        `🚗 Booking menunggu persetujuan GA (sudah disetujui supervisor)\n\n${bookingLines(b)}\n\nBuka: ${appUrl('/approval')}`
      );
      break;
    case 'Approved':
      await safeSend([b.requester_id], `✅ Booking Anda DISETUJUI\n\n${info}`);
      break;
    case 'Rejected By Supervisor':
      await safeSend([b.requester_id], `❌ Booking Anda ditolak Supervisor\n\n${info}`);
      break;
    case 'Rejected By GA':
      await safeSend([b.requester_id], `❌ Booking Anda ditolak GA\n\n${info}`);
      break;
    default:
      break;
  }
}
