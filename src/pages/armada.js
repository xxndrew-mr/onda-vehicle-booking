import React, { useState, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import Toast from '../components/Toast';
import Pagination, { usePagination } from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Reveal from '../components/Reveal';
import { VEHICLE_STATUSES, VEHICLE_STATUS_META, vehicleSpecText } from '../lib/vehicleStatus';

function StatusBadge({ status }) {
  const meta = VEHICLE_STATUS_META[status] || { label: status || '-', cls: 'badge' };
  return <span className={meta.cls}>{meta.label}</span>;
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
    return <div className="p-16 text-center mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Memuat…</div>;
  }

  if (!isGa) {
    return (
      <div className="p-8 min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-3xl text-[var(--ink)]">Akses ditolak</p>
          <p className="text-sm mt-2 text-[var(--muted)]">Hanya General Affairs yang bisa mengelola armada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-4">
      <PageHeader
        eyebrow="Armada"
        title="Manajemen Armada"
        subtitle="Kelola kendaraan, status, dan informasinya."
        right={
          <Button variant="primary" arrow onClick={() => { setForm({ ...emptyForm }); setErrorMsg(''); }}>
            Tambah Kendaraan
          </Button>
        }
      />

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />

      {errorMsg && (
        <div className="mb-4 p-4 rounded-[var(--radius)] border border-[var(--danger-line)] bg-[var(--danger-wash)] text-[var(--danger)] text-sm">
          {errorMsg}
        </div>
      )}

      <Reveal className="panel p-4 sm:p-6">
        {vehicles.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Belum ada kendaraan.</p>
        ) : (
          <>
            {/* Desktop: tabel */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm data-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Plat Nomor</th>
                    <th>Info</th>
                    <th>Status</th>
                    <th>Ubah Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {veh.pageItems.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className="font-medium text-[var(--ink)]">{v.name}</div>
                        {v.notes && <div className="text-xs text-[var(--muted)] max-w-[14rem] truncate" title={v.notes}>{v.notes}</div>}
                      </td>
                      <td className="text-[var(--ink-2)] num">{v.license_plate || '—'}</td>
                      <td className="text-[var(--ink-2)]">{vehicleSpecText(v) || '—'}</td>
                      <td><StatusBadge status={v.status} /></td>
                      <td>
                        <select
                          aria-label="Ubah status"
                          value={v.status || 'Ready'}
                          onChange={(e) => changeStatus(v, e.target.value)}
                          className="field text-sm !min-h-0 py-1.5 max-w-[10rem]"
                        >
                          {VEHICLE_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => { setForm({ ...v }); setErrorMsg(''); }}
                          className="inline-flex items-center gap-1 text-[var(--blue)] hover:underline mono text-[11px] uppercase tracking-[0.1em] font-bold"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: kartu */}
            <div className="md:hidden space-y-3">
              {veh.pageItems.map((v) => (
                <div key={v.id} className="rounded-[10px] border border-[var(--line)] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--ink)] truncate">{v.name}</div>
                      <div className="mono text-[11px] text-[var(--muted)] num mt-0.5">{v.license_plate || '—'}</div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                  {(vehicleSpecText(v) || v.notes) && (
                    <div className="mt-2 text-xs text-[var(--ink-2)]">
                      {[vehicleSpecText(v), v.notes].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <select
                      aria-label="Ubah status"
                      value={v.status || 'Ready'}
                      onChange={(e) => changeStatus(v, e.target.value)}
                      className="field text-sm !min-h-0 py-2 flex-1"
                    >
                      {VEHICLE_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { setForm({ ...v }); setErrorMsg(''); }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[var(--line)] text-[var(--blue)] mono text-[11px] uppercase tracking-[0.1em] font-bold hover:border-[var(--ink)] transition-colors shrink-0"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <Pagination page={veh.page} totalPages={veh.totalPages} total={veh.total} onChange={veh.setPage} />
      </Reveal>

      <p className="mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mt-4">
        Hanya kendaraan berstatus <span className="text-[var(--blue)]">Ready</span> yang bisa dipesan pada halaman Booking.
      </p>

      {form && (
        <div className="fixed inset-0 bg-[var(--ink)]/40 flex items-center justify-center p-4 z-50">
          <div className="panel w-full max-w-md p-6">
            <h2 className="font-display text-2xl text-[var(--ink)] mb-5">
              {form.id ? 'Edit Kendaraan' : 'Tambah Kendaraan'}
            </h2>

            <label className="label block mb-1.5">Nama Kendaraan</label>
            <input
              className="field mb-4 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Toyota Avanza"
              autoFocus
            />

            <label className="label block mb-1.5">Plat Nomor</label>
            <input
              className="field mb-4 text-sm"
              value={form.license_plate}
              onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
              placeholder="Contoh: B 1234 OMI"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1.5">Kapasitas (orang)</label>
                <input
                  type="number"
                  min="0"
                  className="field mb-4 text-sm"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Contoh: 6"
                />
              </div>
              <div>
                <label className="label block mb-1.5">Bahan Bakar</label>
                <input
                  className="field mb-4 text-sm"
                  value={form.fuel_type}
                  onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
                  placeholder="Bensin / Solar / Listrik"
                />
              </div>
            </div>

            <label className="label block mb-1.5">Status</label>
            <select
              className="field mb-4 text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {VEHICLE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <label className="label block mb-1.5">Catatan</label>
            <textarea
              className="field mb-5 text-sm"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Contoh: AC dingin, cocok untuk perjalanan jauh"
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>Batal</Button>
              <Button variant="primary" arrow onClick={saveForm} disabled={saving || !form.name.trim()}>
                {saving ? 'Menyimpan' : 'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
