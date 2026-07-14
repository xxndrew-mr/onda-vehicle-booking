import React, { useState, useEffect, useCallback } from 'react';
import { History, ClipboardCheck, Check, X } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';
import { StatusBadge, AuditLine, vehicleChangeNote, actorName, actorId, ACTIVE_STATUSES, fmtTs } from '../components/BookingStatus';
import Avatar from '../components/Avatar';
import Person from '../components/Person';
import Toast from '../components/Toast';
import Pagination, { usePagination } from '../components/Pagination';

/**
 * Aksi yang tercatat pada sebuah booking (untuk tab Riwayat Persetujuan).
 * Approve/reject disimpulkan dari status: audit tidak pernah dihapus, dan
 * reject bersifat terminal per tahap.
 */
function recordedActions(b) {
  const acts = [];
  if (b.supervisor_action_at) {
    acts.push({
      stage: 'Supervisor',
      by: actorName(b.supervisor_action_by),
      byId: actorId(b.supervisor_action_by),
      at: b.supervisor_action_at,
      approved: b.status !== 'Rejected By Supervisor',
    });
  }
  if (b.ga_action_at) {
    acts.push({
      stage: 'GA',
      by: actorName(b.ga_action_by),
      byId: actorId(b.ga_action_by),
      at: b.ga_action_at,
      approved: b.status !== 'Rejected By GA',
    });
  }
  return acts;
}

export default function Riwayat() {
  const [data, setData] = useState({ mine: [], processed: [], canApprove: false, isAdmin: false });
  const [tab, setTab] = useState('mine');
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const minePage = usePagination(data.mine, 10);
  const procPage = usePagination(data.processed, 10);

  const fetchHistory = useCallback(() => {
    getJson('/api/bookings/history')
      .then((d) => {
        setErrorMsg('');
        setData(d);
      })
      .catch((e) => setErrorMsg(e.message));
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const cancelBooking = async (id) => {
    // Optimistic: ubah status baris jadi Dibatalkan seketika.
    setData((d) => ({
      ...d,
      mine: d.mine.map((b) => (b.id === id ? { ...b, status: 'Cancelled By User' } : b)),
    }));
    setToast({ message: 'Booking dibatalkan.', type: 'success' });
    try {
      await sendJson(`/api/bookings/${id}`, 'PATCH', { action: 'CANCEL' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      fetchHistory();
    }
  };

  const tabBtn = (key, label, Icon) => (
    <button
      onClick={() => setTab(key)}
      className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${
        tab === key
          ? 'border-blue-700 text-blue-800 bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Riwayat</h1>

        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {tabBtn('mine', 'Booking Saya', History)}
          {data.canApprove && tabBtn('processed', 'Riwayat Persetujuan', ClipboardCheck)}
        </div>

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

        {tab === 'mine' && (
          <div className="bg-white rounded-xl shadow p-6">
            {data.mine.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Belum ada booking. Ajukan lewat kalender di halaman Booking.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-4 font-medium">Kendaraan</th>
                      <th className="py-2 pr-4 font-medium">Waktu Pakai</th>
                      <th className="py-2 pr-4 font-medium">Keperluan</th>
                      <th className="py-2 pr-4 font-medium">Diajukan</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {minePage.pageItems.map((b) => (
                      <tr key={b.id} className="border-b last:border-0 align-top">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-800">{b.vehicle_name}</div>
                          {b.license_plate && (
                            <div className="text-xs text-gray-400">{b.license_plate}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-600">
                          {fmtTs(b.start_time)}
                          <div className="text-xs text-gray-400">s/d {fmtTs(b.end_time)}</div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 max-w-[16rem]">
                          <div className="truncate" title={b.purpose}>{b.purpose}</div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-500">
                          {fmtTs(b.created_at)}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={b.status} />
                          <div className="text-xs text-gray-400 mt-1"><AuditLine b={b} /></div>
                          {vehicleChangeNote(b) && (
                            <div className="text-xs text-amber-700 mt-1">{vehicleChangeNote(b)}</div>
                          )}
                        </td>
                        <td className="py-3 whitespace-nowrap text-right">
                          {ACTIVE_STATUSES.includes(b.status) && (
                            <button
                              onClick={() => cancelBooking(b.id)}
                              className="text-red-600 hover:underline text-xs font-medium"
                            >
                              Batalkan
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={minePage.page} totalPages={minePage.totalPages} total={minePage.total} onChange={minePage.setPage} />
          </div>
        )}

        {tab === 'processed' && data.canApprove && (
          <div className="bg-white rounded-xl shadow p-6">
            {data.isAdmin && (
              <p className="text-xs text-gray-400 mb-4">
                Anda Administrator — menampilkan seluruh riwayat persetujuan (semua approver).
              </p>
            )}
            {data.processed.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Belum ada booking yang Anda proses.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-4 font-medium">Kendaraan</th>
                      <th className="py-2 pr-4 font-medium">Pemohon</th>
                      <th className="py-2 pr-4 font-medium">Waktu Pakai</th>
                      <th className="py-2 pr-4 font-medium">Keperluan</th>
                      <th className="py-2 pr-4 font-medium">Status Akhir</th>
                      <th className="py-2 font-medium">Aksi Tercatat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procPage.pageItems.map((b) => (
                      <tr key={b.id} className="border-b last:border-0 align-top">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-800">{b.vehicle_name}</div>
                          {b.license_plate && (
                            <div className="text-xs text-gray-400">{b.license_plate}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Avatar src={b.requester_avatar} name={b.user_name} size={28} />
                            <div>
                              <div className="text-gray-700">{b.user_name}</div>
                              {b.requester_department && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  {b.requester_department}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-600">
                          {fmtTs(b.start_time)}
                          <div className="text-xs text-gray-400">s/d {fmtTs(b.end_time)}</div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 max-w-[14rem]">
                          <div className="truncate" title={b.purpose}>{b.purpose}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="py-3 space-y-1">
                          {recordedActions(b).map((a) => (
                            <div key={a.stage} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                              {a.approved ? (
                                <Check size={13} className="text-green-600 shrink-0" />
                              ) : (
                                <X size={13} className="text-red-600 shrink-0" />
                              )}
                              <span className="text-gray-600 inline-flex items-center gap-1">
                                {a.stage}: {a.approved ? 'Disetujui' : 'Ditolak'}
                                {a.by ? (
                                  <>oleh <Person name={a.by} openId={a.byId} size={16} /></>
                                ) : null}
                              </span>
                              <span className="text-gray-400">· {fmtTs(a.at)}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={procPage.page} totalPages={procPage.totalPages} total={procPage.total} onChange={procPage.setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
