import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Car, UserCheck, Building2, AlertTriangle } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';
import { isVehicleAvailable, VEHICLE_STATUS_META } from '../lib/vehicleStatus';
import Avatar from '../components/Avatar';
import Person from '../components/Person';
import Toast from '../components/Toast';
import Pagination, { usePagination } from '../components/Pagination';

const fmt = (t) => (t?.value ? new Date(t.value).toLocaleString('id-ID') : '-');

function RequesterLine({ item }) {
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <Avatar src={item.requester_avatar} name={item.user_name} size={24} />
      {item.user_name}
      {item.requester_department && (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
          {item.requester_department}
        </span>
      )}
    </div>
  );
}

// Kartu tahap supervisor (Approve/Reject sederhana).
function SupervisorCard({ item, onAction, stageInfo }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md flex justify-between items-center">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-semibold text-lg text-blue-700">
          <Car size={20} /> {item.vehicle_name} ({item.license_plate})
        </div>
        <RequesterLine item={item} />
        {stageInfo && <p className="text-xs text-gray-400">{stageInfo}</p>}
        <p className="text-sm text-gray-500 italic">&ldquo;Keperluan: {item.purpose}&rdquo;</p>
        <p className="text-xs text-gray-400">Waktu: {fmt(item.start_time)} &mdash; {fmt(item.end_time)}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onAction(item.id, 'APPROVE')}
          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
        >
          <Check size={18} /> Approve
        </button>
        <button
          onClick={() => onAction(item.id, 'REJECT')}
          className="flex items-center gap-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
        >
          <X size={18} /> Reject
        </button>
      </div>
    </div>
  );
}

// Kartu tahap GA — pergantian armada hanya muncul bila kendaraan bermasalah.
function GaCard({ item, onAction, stageInfo, availableVehicles }) {
  const hasIssue = !isVehicleAvailable(item.vehicle_status);
  const [swap, setSwap] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [reason, setReason] = useState('');

  const options = availableVehicles.filter((v) => v.id !== item.vehicle_id);
  const swapReady = newVehicleId && reason.trim();

  const approve = () => {
    if (swap) {
      if (!swapReady) return;
      onAction(item.id, 'APPROVE', { new_vehicle_id: newVehicleId, reason: reason.trim() });
    } else {
      onAction(item.id, 'APPROVE');
    }
  };

  const statusMeta = VEHICLE_STATUS_META[item.vehicle_status] || null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold text-lg text-blue-700">
            <Car size={20} /> {item.vehicle_name} ({item.license_plate})
            {statusMeta && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                {statusMeta.label}
              </span>
            )}
          </div>
          <RequesterLine item={item} />
          {stageInfo && <p className="text-xs text-gray-400">{stageInfo}</p>}
          <p className="text-sm text-gray-500 italic">&ldquo;Keperluan: {item.purpose}&rdquo;</p>
          <p className="text-xs text-gray-400">Waktu: {fmt(item.start_time)} &mdash; {fmt(item.end_time)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={approve}
            disabled={swap && !swapReady}
            className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50"
          >
            <Check size={18} /> {swap ? 'Setujui + Ganti' : 'Approve'}
          </button>
          <button
            onClick={() => onAction(item.id, 'REJECT')}
            className="flex items-center gap-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
          >
            <X size={18} /> Reject
          </button>
        </div>
      </div>

      {/* Pergantian armada hanya diizinkan bila kendaraan yang diajukan bermasalah */}
      {hasIssue ? (
        <div className="mt-4 pt-4 border-t">
          <label className="flex items-center gap-2 text-sm text-amber-700 font-medium">
            <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} />
            <AlertTriangle size={15} /> Ganti armada karena kendala operasional
          </label>

          {swap && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kendaraan pengganti</label>
                <select
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="">— pilih kendaraan —</option>
                  {options.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.license_plate})</option>
                  ))}
                </select>
                {options.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Tidak ada kendaraan Ready lain.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Alasan pergantian (wajib)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="Contoh: kendaraan sedang maintenance"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400">
          Kendaraan tersedia (Ready) — pergantian armada tidak diperlukan.
        </p>
      )}
    </div>
  );
}

export default function Approvals() {
  const [queues, setQueues] = useState({ supervisorQueue: [], gaQueue: [], role: '' });
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const fetchPending = useCallback(() => {
    getJson('/api/bookings/pending')
      .then((data) => {
        setErrorMsg('');
        setQueues(data);
      })
      .catch((err) => setErrorMsg(err.message));
  }, []);

  useEffect(() => {
    fetchPending();
    getJson('/api/vehicles')
      .then((data) => setAvailableVehicles(data.filter((v) => isVehicleAvailable(v.status))))
      .catch(() => {});
  }, [fetchPending]);

  const handleAction = async (id, action, extra = {}) => {
    // Optimistic: hapus kartu dari antrian seketika agar terasa instan.
    setQueues((q) => ({
      ...q,
      supervisorQueue: q.supervisorQueue.filter((b) => b.id !== id),
      gaQueue: q.gaQueue.filter((b) => b.id !== id),
    }));
    try {
      const res = await sendJson(`/api/bookings/${id}`, 'PATCH', { action, ...extra });
      setToast({ message: res.message || 'Berhasil diproses.', type: 'success' });
    } catch (err) {
      // Gagal → kembalikan tampilan agar sinkron dengan server.
      setToast({ message: err.message, type: 'error' });
      fetchPending();
    }
  };

  const supPage = usePagination(queues.supervisorQueue, 10);
  const gaPage = usePagination(queues.gaQueue, 10);

  const isAdmin = queues.role === 'ADMIN';
  const isGa = queues.role === 'GA' || isAdmin;
  // Seksi supervisor hanya untuk supervisor (leader di Lark) / admin / bila ada antrian.
  // Untuk GA murni (bukan supervisor), seksi ini disembunyikan.
  const showSupervisor = isAdmin || !!queues.is_supervisor || queues.supervisorQueue.length > 0;
  const nothingToDo =
    (!showSupervisor || queues.supervisorQueue.length === 0) &&
    (!isGa || queues.gaQueue.length === 0);

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Persetujuan Booking</h1>

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

        {isAdmin && (
          <p className="mb-4 text-sm text-gray-500">
            Anda login sebagai <span className="font-semibold">Administrator</span> — bisa memproses
            semua tahap (supervisor mana pun & GA).
          </p>
        )}

        {showSupervisor && (
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-3">
            <UserCheck size={20} />{' '}
            {isAdmin ? 'Tahap Supervisor (semua divisi)' : 'Menunggu Persetujuan Saya (Supervisor)'}
          </h2>
          {queues.supervisorQueue.length === 0 ? (
            <div className="bg-white p-6 text-center text-gray-500 rounded-lg shadow-sm">
              {isAdmin ? 'Tidak ada pengajuan di tahap supervisor.' : 'Tidak ada pengajuan dari anggota tim Anda.'}
            </div>
          ) : (
            <div className="space-y-4">
              {supPage.pageItems.map((item) => (
                <SupervisorCard
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                  stageInfo={
                    isAdmin ? (
                      <span className="inline-flex items-center gap-1">
                        Supervisor pemohon:{' '}
                        {item.supervisor_name ? (
                          <Person name={item.supervisor_name} openId={item.supervisor_id} size={18} />
                        ) : (
                          '—'
                        )}
                      </span>
                    ) : (
                      'Anda adalah supervisor pemohon (dari struktur organisasi Lark).'
                    )
                  }
                />
              ))}
            </div>
          )}
          <Pagination page={supPage.page} totalPages={supPage.totalPages} total={supPage.total} onChange={supPage.setPage} />
        </section>
        )}

        {isGa && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-3">
              <Building2 size={20} /> Antrian General Affairs
            </h2>
            {queues.gaQueue.length === 0 ? (
              <div className="bg-white p-6 text-center text-gray-500 rounded-lg shadow-sm">
                Tidak ada antrian untuk GA.
              </div>
            ) : (
              <div className="space-y-4">
                {gaPage.pageItems.map((item) => (
                  <GaCard
                    key={item.id}
                    item={item}
                    onAction={handleAction}
                    availableVehicles={availableVehicles}
                    stageInfo={
                      item.supervisor_name ? (
                        <span className="inline-flex items-center gap-1">
                          Sudah disetujui supervisor:{' '}
                          <Person name={item.supervisor_name} openId={item.supervisor_id} size={18} />
                        </span>
                      ) : (
                        'Langsung ke GA (pemohon tidak punya supervisor di Lark).'
                      )
                    }
                  />
                ))}
              </div>
            )}
            <Pagination page={gaPage.page} totalPages={gaPage.totalPages} total={gaPage.total} onChange={gaPage.setPage} />
          </section>
        )}

        {nothingToDo && !errorMsg && (
          <div className="mt-6 bg-white p-10 text-center rounded-lg shadow">
            Tidak ada antrian pending untuk Anda. 🎉
          </div>
        )}
      </div>
    </div>
  );
}
