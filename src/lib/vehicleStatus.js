// Status armada kendaraan — dipakai bersama frontend & backend (tanpa import server).

export const VEHICLE_STATUSES = ['Ready', 'In Use', 'Maintenance', 'Unavailable'];

// Hanya 'Ready' yang boleh dipesan.
export const AVAILABLE_STATUS = 'Ready';

export function isVehicleAvailable(status) {
  return status === AVAILABLE_STATUS;
}

// Ringkasan spesifikasi "6 orang · Bensin" untuk tabel/booking.
export function vehicleSpecText(v) {
  const parts = [];
  if (v?.capacity) parts.push(`${v.capacity} orang`);
  if (v?.fuel_type) parts.push(v.fuel_type);
  return parts.join(' · ');
}

// Label + varian badge status kendaraan. Palet: biru (ready) · danger (bermasalah) · monokrom.
export const VEHICLE_STATUS_META = {
  Ready: { label: 'Ready', cls: 'badge badge--blue' },
  'In Use': { label: 'In Use', cls: 'badge' },
  Maintenance: { label: 'Maintenance', cls: 'badge badge--danger' },
  Unavailable: { label: 'Unavailable', cls: 'badge badge--danger' },
};
