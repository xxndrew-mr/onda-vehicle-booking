import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Car, User, UserCheck, Building2 } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';

const fmt = (t) => (t?.value ? new Date(t.value).toLocaleString('id-ID') : '-');

function BookingCard({ item, onAction, stageInfo }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md flex justify-between items-center">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-semibold text-lg text-blue-700">
          <Car size={20} /> {item.vehicle_name} ({item.license_plate})
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <User size={16} /> {item.user_name}
        </div>
        {stageInfo && <p className="text-xs text-gray-400">{stageInfo}</p>}
        <p className="text-sm text-gray-500 italic">&ldquo;Keperluan: {item.purpose}&rdquo;</p>
        <p className="text-xs text-gray-400">
          Waktu: {fmt(item.start_time)} &mdash; {fmt(item.end_time)}
        </p>
      </div>

      <div className="flex gap-2">
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

export default function Approvals() {
  const [queues, setQueues] = useState({ supervisorQueue: [], gaQueue: [], role: '' });
  const [errorMsg, setErrorMsg] = useState('');

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
  }, [fetchPending]);

  const [actionMsg, setActionMsg] = useState('');

  const handleAction = async (id, action) => {
    try {
      await sendJson(`/api/bookings/${id}`, 'PATCH', { action });
      setActionMsg(`Booking berhasil di-${action === 'APPROVE' ? 'setujui' : 'tolak'}.`);
      fetchPending();
    } catch (err) {
      setActionMsg('');
      setErrorMsg(err.message);
    }
  };

  const isGa = queues.role === 'GA' || queues.role === 'ADMIN';
  const nothingToDo = queues.supervisorQueue.length === 0 && (!isGa || queues.gaQueue.length === 0);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Persetujuan Booking</h1>

        {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg">
            <span className="font-semibold">Gagal memuat data:</span> {errorMsg}
          </div>
        )}

        {actionMsg && (
          <div className="mb-4 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg">
            {actionMsg}
          </div>
        )}

        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-3">
            <UserCheck size={20} /> Menunggu Persetujuan Saya (Supervisor)
          </h2>
          {queues.supervisorQueue.length === 0 ? (
            <div className="bg-white p-6 text-center text-gray-500 rounded-lg shadow-sm">
              Tidak ada pengajuan dari anggota tim Anda.
            </div>
          ) : (
            <div className="space-y-4">
              {queues.supervisorQueue.map((item) => (
                <BookingCard
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                  stageInfo="Anda adalah supervisor pemohon (dari struktur organisasi Lark)."
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
                  <BookingCard
                    key={item.id}
                    item={item}
                    onAction={handleAction}
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
