import { sendLarkCard, larkAppLink } from './lark';
import getBigQuery from './bigquery';

const DATASET = 'onda_booking_db';

// Link di pesan bot dibungkus applink → dibuka di dalam klien Lark, sehingga
// sesi Lark tersedia dan SSO otomatis (tanpa halaman login seperti di browser luar).
function appUrl(path = '') {
  const base = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  return base ? larkAppLink(`${base}${path}`) : '';
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

// Kartu interaktif Lark: judul berwarna + detail (lark_md) + tombol link.
// Link jadi TOMBOL (bukan URL panjang di teks).
function buildCard({ title, template, lines, button }) {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: title }, template },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: lines } },
      ...(button
        ? [{
            tag: 'action',
            actions: [{
              tag: 'button',
              text: { tag: 'plain_text', content: button.label },
              type: 'primary',
              url: button.url,
            }],
          }]
        : []),
    ],
  };
}

// Kirim kartu ke banyak open_id; kegagalan notifikasi TIDAK boleh mengganggu alur utama.
async function safeSend(openIds, card) {
  const targets = [...new Set((openIds || []).filter(Boolean))];
  await Promise.all(
    targets.map((id) =>
      sendLarkCard(id, card).catch((e) => console.error('[notify] gagal ke', id, e.message))
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
  `**Pemohon:** ${b.user_name}${b.requester_department ? ` (${b.requester_department})` : ''}\n` +
  `**Kendaraan:** ${b.vehicle_name}\n` +
  `**Waktu:** ${fmtRange(b.start_time, b.end_time)}\n` +
  `**Keperluan:** ${b.purpose || '-'}`;

const approvalButton = () => ({ label: 'Buka Halaman Approval', url: appUrl('/approval') });
const riwayatButton = () => ({ label: 'Lihat Riwayat Saya', url: appUrl('/riwayat') });

export async function notifyBookingCreated(b) {
  if (b.status === 'Pending Supervisor' && b.supervisor_id) {
    await safeSend([b.supervisor_id], buildCard({
      title: '🚗 Booking baru menunggu persetujuan Anda (Supervisor)',
      template: 'blue',
      lines: bookingLines(b),
      button: approvalButton(),
    }));
  } else if (b.status === 'Pending GA') {
    await safeSend(await gaApproverOpenIds(), buildCard({
      title: '🚗 Booking menunggu persetujuan GA',
      template: 'blue',
      lines: bookingLines(b),
      button: approvalButton(),
    }));
  }
}

// GA mengganti armada pada booking yang sudah Approved → beri tahu pemohon.
export async function notifyVehicleChanged(b, reason) {
  await safeSend([b.requester_id], buildCard({
    title: '🔄 Kendaraan booking Anda diganti oleh GA',
    template: 'blue',
    lines:
      `**Kendaraan (baru):** ${b.vehicle_name}\n` +
      `**Waktu:** ${fmtRange(b.start_time, b.end_time)}\n` +
      `**Alasan:** ${reason || '-'}`,
    button: riwayatButton(),
  }));
}

export async function notifyTransition(b, nextStatus) {
  const info = `**Kendaraan:** ${b.vehicle_name}\n**Waktu:** ${fmtRange(b.start_time, b.end_time)}`;
  switch (nextStatus) {
    case 'Pending GA':
      await safeSend(await gaApproverOpenIds(), buildCard({
        title: '🚗 Booking menunggu persetujuan GA',
        template: 'blue',
        lines: `${bookingLines(b)}\n\n_Sudah disetujui supervisor._`,
        button: approvalButton(),
      }));
      break;
    case 'Approved':
      await safeSend([b.requester_id], buildCard({
        title: '✅ Booking Anda DISETUJUI',
        template: 'green',
        lines: info,
        button: riwayatButton(),
      }));
      break;
    case 'Rejected By Supervisor':
      await safeSend([b.requester_id], buildCard({
        title: '❌ Booking Anda ditolak Supervisor',
        template: 'red',
        lines: info,
        button: riwayatButton(),
      }));
      break;
    case 'Rejected By GA':
      await safeSend([b.requester_id], buildCard({
        title: '❌ Booking Anda ditolak GA',
        template: 'red',
        lines: info,
        button: riwayatButton(),
      }));
      break;
    default:
      break;
  }
}
