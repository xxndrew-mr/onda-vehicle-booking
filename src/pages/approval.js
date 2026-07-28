import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';
import { isVehicleAvailable, VEHICLE_STATUS_META } from '../lib/vehicleStatus';
import Avatar from '../components/Avatar';
import Person from '../components/Person';
import Toast from '../components/Toast';
import Pagination, { usePagination } from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Reveal from '../components/Reveal';
import { SectionHead } from '../components/Eyebrow';

const fmt = (t) => (t?.value ? new Date(t.value).toLocaleString('id-ID') : '-');

function RequesterLine({ item }) {
  return (
    <div className="flex items-center gap-2 text-[var(--ink-2)] text-sm">
      <Avatar src={item.requester_avatar} name={item.user_name} size={24} />
      {item.user_name}
      {item.requester_department && (
        <span className="badge badge--blue">{item.requester_department}</span>
      )}
    </div>
  );
}

function SupervisorCard({ item, onAction, stageInfo }) {
  return (
    <div className="panel p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        <div className="font-display text-xl text-[var(--ink)]">
          {item.vehicle_name}{' '}
          <span className="mono text-[11px] tracking-[0.1em] text-[var(--muted)] align-middle">
            {item.license_plate}
          </span>
        </div>
        <RequesterLine item={item} />
        {stageInfo && <p className="text-xs text-[var(--muted)]">{stageInfo}</p>}
        <p className="text-sm text-[var(--ink-2)] italic">&ldquo;Keperluan: {item.purpose}&rdquo;</p>
        <p className="mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">
          {fmt(item.start_time)} &mdash; {fmt(item.end_time)}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="primary" arrow onClick={() => onAction(item.id, 'APPROVE')}>Setujui</Button>
        <Button variant="danger" onClick={() => onAction(item.id, 'REJECT')}>Tolak</Button>
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
  // Efektif hanya bila kendaraan MASIH bermasalah — bila kembali Ready (mis.
  // setelah refetch), centang basi diabaikan agar tombol tidak terkunci.
  const wantsSwap = swap && hasIssue;

  const approve = () => {
    if (wantsSwap) {
      if (!swapReady) return;
      onAction(item.id, 'APPROVE', { new_vehicle_id: newVehicleId, reason: reason.trim() });
    } else {
      onAction(item.id, 'APPROVE');
    }
  };

  const statusMeta = VEHICLE_STATUS_META[item.vehicle_status] || null;

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 font-display text-xl text-[var(--ink)]">
            {item.vehicle_name}{' '}
            <span className="mono text-[11px] tracking-[0.1em] text-[var(--muted)] align-middle">
              {item.license_plate}
            </span>
            {statusMeta && <span className={statusMeta.cls}>{statusMeta.label}</span>}
          </div>
          <RequesterLine item={item} />
          {stageInfo && <p className="text-xs text-[var(--muted)]">{stageInfo}</p>}
          <p className="text-sm text-[var(--ink-2)] italic">&ldquo;Keperluan: {item.purpose}&rdquo;</p>
          <p className="mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">
            {fmt(item.start_time)} &mdash; {fmt(item.end_time)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="primary" arrow onClick={approve} disabled={wantsSwap && !swapReady}>
            {wantsSwap ? 'Setujui + Ganti' : 'Setujui'}
          </Button>
          <Button variant="danger" onClick={() => onAction(item.id, 'REJECT')}>Tolak</Button>
        </div>
      </div>

      {/* Pergantian armada hanya diizinkan bila kendaraan yang diajukan bermasalah */}
      {hasIssue ? (
        <div className="mt-5 pt-5 hairline">
          <label className="flex items-center gap-2 text-sm text-[var(--danger)] font-medium cursor-pointer">
            <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} />
            <AlertTriangle size={15} /> Ganti armada karena kendala operasional
          </label>

          {swap && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label block mb-1.5">Kendaraan pengganti</label>
                <select
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                  className="field text-sm"
                >
                  <option value="">— pilih kendaraan —</option>
                  {options.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.license_plate})</option>
                  ))}
                </select>
                {options.length === 0 && (
                  <p className="text-xs text-[var(--danger)] mt-1.5">Tidak ada kendaraan Ready lain.</p>
                )}
              </div>
              <div>
                <label className="label block mb-1.5">Alasan pergantian (wajib)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="field text-sm"
                  placeholder="Contoh: kendaraan sedang maintenance"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">
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
    // Optimistic: APPROVE tahap supervisor oleh viewer GA/ADMIN → booking jadi
    // Pending GA, jadi kartunya DIPINDAH ke antrian GA (bukan hilang — antrian
    // GA di layar tetap sinkron dengan server). Selain itu: hapus dari antrian.
    setQueues((q) => {
      const fromSup = q.supervisorQueue.find((b) => b.id === id);
      const viewerIsGa = q.role === 'GA' || q.role === 'ADMIN';
      const moveToGa = action === 'APPROVE' && fromSup && viewerIsGa;
      return {
        ...q,
        supervisorQueue: q.supervisorQueue.filter((b) => b.id !== id),
        gaQueue: moveToGa
          ? [...q.gaQueue.filter((b) => b.id !== id), fromSup]
          : q.gaQueue.filter((b) => b.id !== id),
      };
    });
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
  const gaNum = showSupervisor ? '02' : '01';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-4">
      <PageHeader
        eyebrow="Persetujuan"
        title="Persetujuan Booking"
        subtitle="Tinjau dan proses pengajuan booking kendaraan."
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

      {isAdmin && (
        <p className="mb-6 text-sm text-[var(--muted)]">
          Anda login sebagai <span className="text-[var(--ink)] font-medium">Administrator</span> — bisa
          memproses semua tahap (supervisor mana pun &amp; GA).
        </p>
      )}

      {showSupervisor && (
        <section className="mb-10">
          <SectionHead
            num="01"
            title={isAdmin ? 'Tahap Supervisor' : 'Persetujuan Saya'}
            tag={isAdmin ? 'Semua divisi' : 'Supervisor'}
          />
          {queues.supervisorQueue.length === 0 ? (
            <div className="panel p-10 text-center text-sm text-[var(--muted)]">
              {isAdmin ? 'Tidak ada pengajuan di tahap supervisor.' : 'Tidak ada pengajuan dari anggota tim Anda.'}
            </div>
          ) : (
            <div className="space-y-4">
              {supPage.pageItems.map((item, i) => (
                <Reveal key={item.id} delay={i * 60}>
                  <SupervisorCard
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
                </Reveal>
              ))}
            </div>
          )}
          <Pagination page={supPage.page} totalPages={supPage.totalPages} total={supPage.total} onChange={supPage.setPage} />
        </section>
      )}

      {isGa && (
        <section>
          <SectionHead num={gaNum} title="Antrian General Affairs" tag="GA" />
          {queues.gaQueue.length === 0 ? (
            <div className="panel p-10 text-center text-sm text-[var(--muted)]">
              Tidak ada antrian untuk GA.
            </div>
          ) : (
            <div className="space-y-4">
              {gaPage.pageItems.map((item, i) => (
                <Reveal key={item.id} delay={i * 60}>
                  <GaCard
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
                        'Langsung ke GA (tanpa tahap supervisor).'
                      )
                    }
                  />
                </Reveal>
              ))}
            </div>
          )}
          <Pagination page={gaPage.page} totalPages={gaPage.totalPages} total={gaPage.total} onChange={gaPage.setPage} />
        </section>
      )}

      {nothingToDo && !errorMsg && (
        <div className="mt-6 panel p-12 text-center">
          <p className="font-display text-2xl text-[var(--ink)]">Antrian bersih</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Tidak ada pengajuan yang menunggu tindakan Anda.</p>
        </div>
      )}
    </div>
  );
}
