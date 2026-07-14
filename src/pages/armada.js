import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Pencil } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import Toast from '../components/Toast';
import Pagination, { usePagination } from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import { VEHICLE_STATUSES, VEHICLE_STATUS_META, vehicleSpecText } from '../lib/vehicleStatus';

function StatusBadge({ status }) {
  const meta = VEHICLE_STATUS_META[status] || { label: status || '-', cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

const emptyForm = {
  id: null,
  name: '',
  license_plate: '',
  status: 'Ready',
  capacity: '',
  fuel_type: '',
  notes: '',
};

export default function Armada() {
  const { user, loading } = useAuth();
  const isGa = user && (user.role === 'GA' || user.role === 'ADMIN');

  const [vehicles, setVehicles] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [form, setForm] = useState(null); // null | emptyForm(tambah) | vehicle(edit)
  const [saving, setSaving] = useState(false);
  const veh = usePagination(vehicles, 10);

  const fetchVehicles = useCallback(() => {
    getJson('/api/vehicles')
      .then((data) => {
        setErrorMsg('');
        setVehicles(data);
      })
      .catch((e) => setErrorMsg(e.message));
  }, []);

  useEffect(() => {
    if (isGa) fetchVehicles();
  }, [isGa, fetchVehicles]);

  // Ubah status langsung dari tabel (optimistic — efek instan; revert bila gagal).
  const changeStatus = async (v, status) => {
    const prev = v.status;
    setVehicles((list) => list.map((x) => (x.id === v.id ? { ...x, status } : x)));
    setToast({ message: `Status ${v.name} diubah menjadi ${status}.`, type: 'success' });
    try {
      await sendJson(`/api/vehicles/${v.id}`, 'PATCH', { status });
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
      setVehicles((list) => list.map((x) => (x.id === v.id ? { ...x, status: prev } : x)));
    }
  };

  const saveForm = async () => {
    if (!form.name.trim()) {
      setToast({ message: 'Nama kendaraan wajib diisi.', type: 'error' });
      return;
    }
    // Kirim SEMUA field yang dikelola (termasuk kapasitas, bahan bakar, catatan).
    const payload = {
      name: form.name.trim(),
      license_plate: form.license_plate,
      status: form.status,
      capacity: form.capacity,
      fuel_type: form.fuel_type,
      notes: form.notes,
    };

    setSaving(true);
    try {
      if (form.id) {
        await sendJson(`/api/vehicles/${form.id}`, 'PATCH', payload);
        // Optimistic: perbarui tampilan seketika.
        setVehicles((list) => list.map((x) => (x.id === form.id ? { ...x, ...payload } : x)));
        setToast({ message: 'Kendaraan diperbarui.', type: 'success' });
        setForm(null);
      } else {
        await sendJson('/api/vehicles', 'POST', payload);
        setToast({ message: 'Kendaraan ditambahkan.', type: 'success' });
        setForm(null);
        fetchVehicles(); // butuh id dari server
      }
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Memuat…</div>;
  }

  if (!isGa) {
    return (
      <div className="p-8 min-h-[60vh] flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold">Akses ditolak</p>
          <p className="text-sm mt-1">Hanya General Affairs yang bisa mengelola armada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={Truck}
          title="Manajemen Armada"
          subtitle="Kelola kendaraan, status, dan informasinya."
          right={
            <button
              onClick={() => { setForm({ ...emptyForm }); setErrorMsg(''); }}
              className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-800 transition shadow-sm"
            >
              <Plus size={18} /> Tambah Kendaraan
            </button>
          }
        />

        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'success' })}
        />

        {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg">
            <span className="font-semibold">Gagal:</span> {errorMsg}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-100 p-6 overflow-x-auto">
          {vehicles.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Belum ada kendaraan.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4 font-medium">Nama</th>
                  <th className="py-2 pr-4 font-medium">Plat Nomor</th>
                  <th className="py-2 pr-4 font-medium">Info</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Ubah Status</th>
                  <th className="py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {veh.pageItems.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 align-top hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-800">{v.name}</div>
                      {v.notes && <div className="text-xs text-gray-400 max-w-[14rem] truncate" title={v.notes}>{v.notes}</div>}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{v.license_plate || '—'}</td>
                    <td className="py-3 pr-4 text-gray-600">{vehicleSpecText(v) || '—'}</td>
                    <td className="py-3 pr-4"><StatusBadge status={v.status} /></td>
                    <td className="py-3 pr-4">
                      <select
                        value={v.status || 'Ready'}
                        onChange={(e) => changeStatus(v, e.target.value)}
                        className="p-1.5 border rounded text-sm"
                      >
                        {VEHICLE_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => { setForm({ ...v }); setErrorMsg(''); }}
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline text-xs font-medium"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pagination page={veh.page} totalPages={veh.totalPages} total={veh.total} onChange={veh.setPage} />
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Hanya kendaraan berstatus <span className="font-semibold">Ready</span> yang bisa dipesan pada halaman Booking.
        </p>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-blue-900 mb-4">
              {form.id ? 'Edit Kendaraan' : 'Tambah Kendaraan'}
            </h2>

            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kendaraan</label>
            <input
              className="w-full border rounded-md p-2 mb-3 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Toyota Avanza"
              autoFocus
            />

            <label className="block text-sm font-medium text-gray-700 mb-1">Plat Nomor</label>
            <input
              className="w-full border rounded-md p-2 mb-3 text-sm"
              value={form.license_plate}
              onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
              placeholder="Contoh: B 1234 OMI"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kapasitas (orang)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded-md p-2 mb-3 text-sm"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Contoh: 6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bahan Bakar</label>
                <input
                  className="w-full border rounded-md p-2 mb-3 text-sm"
                  value={form.fuel_type}
                  onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
                  placeholder="Bensin / Solar / Listrik"
                />
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full border rounded-md p-2 mb-3 text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {VEHICLE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <textarea
              className="w-full border rounded-md p-2 mb-4 text-sm"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Contoh: AC dingin, cocok untuk perjalanan jauh"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setForm(null)}
                disabled={saving}
                className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={saveForm}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 rounded-md bg-blue-700 text-white hover:bg-blue-800 transition disabled:opacity-50"
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
