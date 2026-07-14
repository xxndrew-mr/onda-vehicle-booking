import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Car, User, UserCheck, Building2, AlertTriangle } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';
import { isVehicleAvailable, VEHICLE_STATUS_META } from '../lib/vehicleStatus';

const fmt = (t) => (t?.value ? new Date(t.value).toLocaleString('id-ID') : '-');

function RequesterLine({ item }) {
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <User size={16} /> {item.user_name}
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
  const [actionMsg, setActionMsg] = useState('');

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
    try {
      const res = await sendJson(`/api/bookings/${id}`, 'PATCH', { action, ...extra });
      setActionMsg(res.message || 'Berhasil diproses.');
      setErrorMsg('');
      fetchPending();
    } catch (err) {
      setActionMsg('');
      setErrorMsg(err.message);
    }
  };

  const isAdmin = queues.role === 'ADMIN';
  const isGa = queues.role === 'GA' || isAdmin;
  const nothingToDo = queues.supervisorQueue.length === 0 && (!isGa || queues.gaQueue.length === 0);

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Persetujuan Booking</h1>

        {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg">
            <span className="font-semibold">Gagal:</span> {errorMsg}
          </div>
        )}
        {actionMsg && (
          <div className="mb-4 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg">
            {actionMsg}
          </div>
        )}

        {isAdmin && (
          <p className="mb-4 text-sm text-gray-500">
            Anda login sebagai <span className="font-semibold">Administrator</span> — bisa memproses
            semua tahap (supervisor mana pun & GA).
          </p>
        )}

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
              {queues.supervisorQueue.map((item) => (
                <SupervisorCard
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                  stageInfo={
                    isAdmin
                      ? `Supervisor pemohon: ${item.supervisor_name || '—'}`
                      : 'Anda adalah supervisor pemohon (dari struktur organisasi Lark).'
                  }
                />
              ))}
            </div>
          )}
        </section>

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
                {queues.gaQueue.map((item) => (
                  <GaCard
                    key={item.id}
                    item={item}
                    onAction={handleAction}
                    availableVehicles={availableVehicles}
                    stageInfo={
                      item.supervisor_name
                        ? `Sudah disetujui supervisor: ${item.supervisor_name}`
                        : 'Langsung ke GA (pemohon tidak punya supervisor di Lark).'
                    }
                  />
                ))}
              </div>
            )}
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
