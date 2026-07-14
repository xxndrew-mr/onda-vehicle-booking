// Utilitas status booking yang dipakai lintas halaman (booking, riwayat).

export const ACTIVE_STATUSES = ['Pending Supervisor', 'Pending GA', 'Approved'];

// Label + warna badge per status.
export const STATUS_META = {
  'Pending Supervisor': { label: 'Menunggu Supervisor', cls: 'bg-yellow-100 text-yellow-800' },
  'Pending GA': { label: 'Menunggu GA', cls: 'bg-yellow-100 text-yellow-800' },
  Approved: { label: 'Disetujui', cls: 'bg-green-100 text-green-700' },
  'Rejected By Supervisor': { label: 'Ditolak Supervisor', cls: 'bg-red-100 text-red-700' },
  'Rejected By GA': { label: 'Ditolak GA', cls: 'bg-red-100 text-red-700' },
  'Cancelled By User': { label: 'Dibatalkan', cls: 'bg-gray-200 text-gray-600' },
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

// Audit "Name (ou_xxx)" → "Name" untuk tampilan.
export const actorName = (s) => String(s || '').replace(/\s*\(ou_[^)]*\)\s*$/, '');

// Keterangan tindak lanjut per status (siapa yang memproses / sedang ditunggu).
export function auditInfo(b) {
  switch (b.status) {
    case 'Pending Supervisor':
      return b.supervisor_name ? `Menunggu: ${b.supervisor_name}` : '';
    case 'Pending GA':
      return b.supervisor_action_by ? `Disetujui supervisor: ${actorName(b.supervisor_action_by)}` : '';
    case 'Approved':
      return b.ga_action_by ? `Disetujui GA: ${actorName(b.ga_action_by)}` : '';
    case 'Rejected By Supervisor':
      return b.supervisor_action_by ? `Oleh: ${actorName(b.supervisor_action_by)}` : '';
    case 'Rejected By GA':
      return b.ga_action_by ? `Oleh: ${actorName(b.ga_action_by)}` : '';
    default:
      return '';
  }
}

// Format timestamp — menerima string ISO ataupun objek BigQuery { value }.
export const fmtTs = (t) => {
  const v = typeof t === 'string' ? t : t?.value;
  return v ? new Date(v).toLocaleString('id-ID') : '-';
};
