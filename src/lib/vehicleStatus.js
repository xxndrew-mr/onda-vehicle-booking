// Status armada kendaraan — dipakai bersama frontend & backend (tanpa import server).

export const VEHICLE_STATUSES = ['Ready', 'In Use', 'Maintenance', 'Unavailable'];

// Hanya 'Ready' yang boleh dipesan.
export const AVAILABLE_STATUS = 'Ready';

export function isVehicleAvailable(status) {
  return status === AVAILABLE_STATUS;
}

// Label + warna badge status kendaraan untuk UI.
export const VEHICLE_STATUS_META = {
  Ready: { label: 'Ready', cls: 'bg-green-100 text-green-700' },
  'In Use': { label: 'In Use', cls: 'bg-blue-100 text-blue-700' },
  Maintenance: { label: 'Maintenance', cls: 'bg-amber-100 text-amber-800' },
  Unavailable: { label: 'Unavailable', cls: 'bg-red-100 text-red-700' },
};
