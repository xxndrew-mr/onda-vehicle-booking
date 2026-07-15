import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { History, ClipboardCheck, Check, X, Search } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';
import { StatusBadge, AuditLine, vehicleChangeNote, actorName, actorId, ACTIVE_STATUSES, fmtTs } from '../components/BookingStatus';
import Avatar from '../components/Avatar';
import Person from '../components/Person';
import Toast from '../components/Toast';
import Pagination, { usePagination } from '../components/Pagination';
import PageHeader from '../components/PageHeader';

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

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative mb-5 max-w-sm">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
      <input value={value} onChange={onChange} placeholder={placeholder} className="field pl-10 pr-3 text-sm" />
    </div>
  );
}

function matchesQuery(b, q) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [b.vehicle_name, b.license_plate, b.user_name, b.requester_department, b.purpose, b.status]
    .some((f) => String(f || '').toLowerCase().includes(s));
}

export default function Riwayat() {
  const [data, setData] = useState({ mine: [], processed: [], canApprove: false, isAdmin: false });
  const [tab, setTab] = useState('mine');
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [mineSearch, setMineSearch] = useState('');
  const [procSearch, setProcSearch] = useState('');

  const filteredMine = useMemo(
    () => data.mine.filter((b) => matchesQuery(b, mineSearch)),
    [data.mine, mineSearch]
  );
  const filteredProc = useMemo(
    () => data.processed.filter((b) => matchesQuery(b, procSearch)),
    [data.processed, procSearch]
  );

  const minePage = usePagination(filteredMine, 10);
  const procPage = usePagination(filteredProc, 10);

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
      className={`flex items-center gap-2 pb-3 mono text-[11px] uppercase tracking-[0.12em] transition-colors border-b-2 ${
        tab === key
          ? 'border-[var(--blue)] text-[var(--blue)]'
          : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-4">
      <PageHeader eyebrow="Arsip" title="Riwayat" subtitle="Riwayat booking Anda dan persetujuan." />

      <div className="flex gap-7 border-b border-[var(--line)] mb-8">
        {tabBtn('mine', 'Booking Saya', History)}
        {data.canApprove && tabBtn('processed', 'Riwayat Persetujuan', ClipboardCheck)}
      </div>

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {errorMsg && (
        <div className="mb-4 p-4 rounded-[var(--radius)] border border-[var(--danger-line)] bg-[var(--danger-wash)] text-[var(--danger)] text-sm">
          {errorMsg}
        </div>
      )}

        {tab === 'mine' && (
          <div className="panel p-6">
            <SearchBox
              value={mineSearch}
              onChange={(e) => { setMineSearch(e.target.value); minePage.setPage(1); }}
              placeholder="Cari kendaraan, keperluan, status…"
            />
            {filteredMine.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-8">
                {data.mine.length === 0
                  ? 'Belum ada booking. Ajukan lewat kalender di halaman Booking.'
                  : 'Tidak ada hasil untuk pencarian ini.'}
              </p>
            ) : (
              <>
                {/* Desktop: tabel */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm data-table">
                    <thead>
                      <tr className="text-left text-[var(--muted)] border-b">
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
                        <tr key={b.id}>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-[var(--ink)]">{b.vehicle_name}</div>
                            {b.license_plate && (
                              <div className="text-xs text-[var(--muted)]">{b.license_plate}</div>
                            )}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap text-[var(--ink-2)]">
                            {fmtTs(b.start_time)}
                            <div className="text-xs text-[var(--muted)]">s/d {fmtTs(b.end_time)}</div>
                          </td>
                          <td className="py-3 pr-4 text-[var(--ink-2)] max-w-[16rem]">
                            <div className="truncate" title={b.purpose}>{b.purpose}</div>
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap text-[var(--muted)]">
                            {fmtTs(b.created_at)}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={b.status} />
                            <div className="text-xs text-[var(--muted)] mt-1"><AuditLine b={b} /></div>
                            {vehicleChangeNote(b) && (
                              <div className="text-xs text-[var(--danger)] mt-1">{vehicleChangeNote(b)}</div>
                            )}
                          </td>
                          <td className="py-3 whitespace-nowrap text-right">
                            {ACTIVE_STATUSES.includes(b.status) && (
                              <button
                                onClick={() => cancelBooking(b.id)}
                                className="text-[var(--danger)] hover:underline text-xs font-medium"
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

                {/* Mobile: kartu */}
                <div className="md:hidden space-y-3">
                  {minePage.pageItems.map((b) => (
                    <div key={b.id} className="rounded-[10px] border border-[var(--line)] p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--ink)] break-words">{b.vehicle_name}</div>
                          {b.license_plate && <div className="mono text-[11px] text-[var(--muted)]">{b.license_plate}</div>}
                        </div>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-2.5 space-y-1 text-xs">
                        <div className="text-[var(--ink-2)]"><span className="text-[var(--muted)]">Waktu: </span>{fmtTs(b.start_time)} – {fmtTs(b.end_time)}</div>
                        <div className="text-[var(--ink-2)]"><span className="text-[var(--muted)]">Keperluan: </span>{b.purpose}</div>
                        <div className="text-[var(--muted)]">Diajukan {fmtTs(b.created_at)}</div>
                        <div className="text-[var(--muted)]"><AuditLine b={b} /></div>
                        {vehicleChangeNote(b) && <div className="text-[var(--danger)]">{vehicleChangeNote(b)}</div>}
                      </div>
                      {ACTIVE_STATUSES.includes(b.status) && (
                        <button
                          onClick={() => cancelBooking(b.id)}
                          className="mt-3 inline-flex items-center px-3.5 py-2 rounded-full border border-[var(--danger-line)] text-[var(--danger)] mono text-[11px] uppercase tracking-[0.1em] font-bold hover:bg-[var(--danger-wash)] transition-colors"
                        >
                          Batalkan
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <Pagination page={minePage.page} totalPages={minePage.totalPages} total={minePage.total} onChange={minePage.setPage} />
          </div>
        )}

        {tab === 'processed' && data.canApprove && (
          <div className="panel p-6">
            {data.isAdmin && (
              <p className="text-xs text-[var(--muted)] mb-4">
                Anda Administrator — menampilkan seluruh riwayat persetujuan (semua approver).
              </p>
            )}
            <SearchBox
              value={procSearch}
              onChange={(e) => { setProcSearch(e.target.value); procPage.setPage(1); }}
              placeholder="Cari pemohon, divisi, kendaraan, keperluan…"
            />
            {filteredProc.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-8">
                {data.processed.length === 0
                  ? 'Belum ada booking yang Anda proses.'
                  : 'Tidak ada hasil untuk pencarian ini.'}
              </p>
            ) : (
              <>
                {/* Desktop: tabel */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm data-table">
                    <thead>
                      <tr className="text-left text-[var(--muted)] border-b">
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
                        <tr key={b.id}>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-[var(--ink)]">{b.vehicle_name}</div>
                            {b.license_plate && (
                              <div className="text-xs text-[var(--muted)]">{b.license_plate}</div>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Avatar src={b.requester_avatar} name={b.user_name} size={28} />
                              <div>
                                <div className="text-[var(--ink-2)]">{b.user_name}</div>
                                {b.requester_department && (
                                  <span className="badge badge--blue">
                                    {b.requester_department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap text-[var(--ink-2)]">
                            {fmtTs(b.start_time)}
                            <div className="text-xs text-[var(--muted)]">s/d {fmtTs(b.end_time)}</div>
                          </td>
                          <td className="py-3 pr-4 text-[var(--ink-2)] max-w-[14rem]">
                            <div className="truncate" title={b.purpose}>{b.purpose}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="py-3 space-y-1">
                            {recordedActions(b).map((a) => (
                              <div key={a.stage} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                                {a.approved ? (
                                  <Check size={13} className="text-[var(--blue)] shrink-0" />
                                ) : (
                                  <X size={13} className="text-[var(--danger)] shrink-0" />
                                )}
                                <span className="text-[var(--ink-2)] inline-flex items-center gap-1">
                                  {a.stage}: {a.approved ? 'Disetujui' : 'Ditolak'}
                                  {a.by ? (
                                    <>oleh <Person name={a.by} openId={a.byId} size={16} /></>
                                  ) : null}
                                </span>
                                <span className="text-[var(--muted)]">· {fmtTs(a.at)}</span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: kartu */}
                <div className="md:hidden space-y-3">
                  {procPage.pageItems.map((b) => (
                    <div key={b.id} className="rounded-[10px] border border-[var(--line)] p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--ink)] break-words">{b.vehicle_name}</div>
                          {b.license_plate && <div className="mono text-[11px] text-[var(--muted)]">{b.license_plate}</div>}
                        </div>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <Avatar src={b.requester_avatar} name={b.user_name} size={26} />
                        <div className="min-w-0">
                          <div className="text-sm text-[var(--ink-2)] break-words">{b.user_name}</div>
                        </div>
                        {b.requester_department && <span className="badge badge--blue shrink-0">{b.requester_department}</span>}
                      </div>
                      <div className="mt-2.5 space-y-1 text-xs">
                        <div className="text-[var(--ink-2)]"><span className="text-[var(--muted)]">Waktu: </span>{fmtTs(b.start_time)} – {fmtTs(b.end_time)}</div>
                        <div className="text-[var(--ink-2)]"><span className="text-[var(--muted)]">Keperluan: </span>{b.purpose}</div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-[var(--line)] space-y-1">
                        {recordedActions(b).map((a) => (
                          <div key={a.stage} className="flex items-center gap-1.5 text-xs flex-wrap">
                            {a.approved ? (
                              <Check size={13} className="text-[var(--blue)] shrink-0" />
                            ) : (
                              <X size={13} className="text-[var(--danger)] shrink-0" />
                            )}
                            <span className="text-[var(--ink-2)] inline-flex items-center gap-1 flex-wrap">
                              {a.stage}: {a.approved ? 'Disetujui' : 'Ditolak'}
                              {a.by ? (
                                <>oleh <Person name={a.by} openId={a.byId} size={16} /></>
                              ) : null}
                            </span>
                            <span className="text-[var(--muted)]">· {fmtTs(a.at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Pagination page={procPage.page} totalPages={procPage.totalPages} total={procPage.total} onChange={procPage.setPage} />
          </div>
        )}
    </div>
  );
}
