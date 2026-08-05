// Utilitas status booking yang dipakai lintas halaman (booking, riwayat).
import Person from './Person';

export const ACTIVE_STATUSES = ['Pending Supervisor', 'Pending GA', 'Approved'];

// Label + varian badge per status. Palet: biru (disetujui) · danger (ditolak) · monokrom.
export const STATUS_META = {
  'Pending Supervisor': { label: 'Menunggu Supervisor', cls: 'badge' },
  'Pending GA': { label: 'Menunggu GA', cls: 'badge' },
  Approved: { label: 'Disetujui', cls: 'badge badge--blue' },
  'Rejected By Supervisor': { label: 'Ditolak Supervisor', cls: 'badge badge--danger' },
  'Rejected By GA': { label: 'Ditolak GA', cls: 'badge badge--danger' },
  'Cancelled By User': { label: 'Dibatalkan', cls: 'badge' },
  'Cancelled By GA': { label: 'Dibatalkan GA', cls: 'badge' },
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: 'badge' };
  return <span className={meta.cls}>{meta.label}</span>;
}

// Audit "Name (ou_xxx)" → "Name" untuk tampilan.
export const actorName = (s) => String(s || '').replace(/\s*\(ou_[^)]*\)\s*$/, '');

// Audit "Name (ou_xxx)" → "ou_xxx" (open_id, untuk mencari avatar).
export const actorId = (s) => {
  const m = String(s || '').match(/\((ou_[^)]+)\)/);
  return m ? m[1] : '';
};

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

// Baris info approval dengan foto profil orang yang disebut.
export function AuditLine({ b, size = 16, className = '' }) {
  const line = (prefix, name, openId) =>
    name ? (
      <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
        {prefix} <Person name={name} openId={openId} size={size} />
      </span>
    ) : null;

  switch (b.status) {
    case 'Pending Supervisor':
      return line('Menunggu:', b.supervisor_name, b.supervisor_id);
    case 'Pending GA':
      return line('Disetujui supervisor:', actorName(b.supervisor_action_by), actorId(b.supervisor_action_by));
    case 'Approved':
      return line('Disetujui GA:', actorName(b.ga_action_by), actorId(b.ga_action_by));
    case 'Rejected By Supervisor':
      return line('Ditolak oleh:', actorName(b.supervisor_action_by), actorId(b.supervisor_action_by));
    case 'Rejected By GA':
      return line('Ditolak oleh:', actorName(b.ga_action_by), actorId(b.ga_action_by));
    default:
      return null;
  }
}

// Catatan pergantian armada oleh GA (untuk pemohon).
export function vehicleChangeNote(b) {
  return b.vehicle_change_reason
    ? `Kendaraan diganti oleh GA. Alasan: ${b.vehicle_change_reason}`
    : '';
}

// Format timestamp — menerima string ISO ataupun objek BigQuery { value }.
export const fmtTs = (t) => {
  const v = typeof t === 'string' ? t : t?.value;
  return v ? new Date(v).toLocaleString('id-ID') : '-';
};
