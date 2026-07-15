import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getJson, sendJson } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import { StatusBadge, AuditLine, vehicleChangeNote, ACTIVE_STATUSES, fmtTs } from '../components/BookingStatus';
import { isVehicleAvailable, vehicleSpecText } from '../lib/vehicleStatus';
import Avatar from '../components/Avatar';
import Toast from '../components/Toast';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Reveal from '../components/Reveal';
import VehicleTimeline from '../components/VehicleTimeline';

// Timeline hanya menampilkan booking AKTIF (Pending/Approved). Rejected & Cancelled
// disembunyikan (slot bebas) — record tetap ada di Riwayat user.
const isActiveBooking = (status) => {
  const s = String(status || '');
  return !s.includes('Rejected') && !s.includes('Cancelled');
};

const getEventColor = (status) => (status === 'Approved' ? '#22c55e' : '#f59e0b'); // hijau / kuning

const fmt = fmtTs;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const pad = (n) => String(n).padStart(2, '0');
// Format untuk <input type="datetime-local"> / <input type="date"> (waktu lokal).
const toLocalInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]); // booking aktif, semua tanggal
  const [vehicles, setVehicles] = useState([]); // SEMUA kendaraan (baris timeline; non-Ready redup)
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [date, setDate] = useState(() => startOfDay(new Date())); // hari yang ditampilkan

  // Modal booking: kendaraan terpilih dari baris yang di-drag; jam bisa disesuaikan.
  const [draft, setDraft] = useState(null); // { start: Date, end: Date }
  const [modalVehicleId, setModalVehicleId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal detail + pembatalan booking.
  const [detail, setDetail] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = useCallback(() => {
    getJson('/api/bookings')
      .then((data) => {
        const list = data
          .filter((b) => b.start_time?.value && b.end_time?.value && isActiveBooking(b.status))
          .map((b) => ({
            id: b.id,
            vehicle_id: b.vehicle_id,
            user_name: b.user_name,
            purpose: b.purpose,
            status: b.status,
            start: new Date(b.start_time.value),
            end: new Date(b.end_time.value),
            raw: b,
          }));
        setErrorMsg('');
        setEvents(list);
      })
      .catch((err) => setErrorMsg(err.message));
  }, []);

  useEffect(() => {
    fetchBookings();
    getJson('/api/vehicles')
      .then((data) => {
        // Ready dulu (bisa dibooking), lalu sisanya — urut nama.
        const sorted = [...data].sort((a, b) => {
          const ra = isVehicleAvailable(a.status) ? 0 : 1;
          const rb = isVehicleAvailable(b.status) ? 0 : 1;
          return ra - rb || String(a.name).localeCompare(String(b.name));
        });
        setVehicles(sorted);
      })
      .catch((err) => setErrorMsg(err.message));
  }, [fetchBookings]);

  // Kendaraan Ready yang BEBAS pada rentang [start, end) — bentrok dicek terhadap
  // booking aktif (client-side; server tetap validasi 409).
  const vehiclesFreeForSlot = useCallback(
    (start, end) =>
      vehicles.filter((v) => {
        if (!isVehicleAvailable(v.status)) return false;
        return !events.some((ev) => ev.vehicle_id === v.id && ev.start < end && ev.end > start);
      }),
    [vehicles, events]
  );

  // Dari timeline: drag di baris kendaraan → modal dengan kendaraan itu terpilih.
  const handleSelectRange = (vehicle, start, end) => {
    setPurpose('');
    setModalVehicleId(vehicle.id);
    setDraft({ start, end });
  };

  const validRange = !!draft && draft.end > draft.start;
  const slotVehicles = useMemo(
    () => (validRange ? vehiclesFreeForSlot(draft.start, draft.end) : []),
    [validRange, draft, vehiclesFreeForSlot]
  );

  // Bila kendaraan terpilih jadi bentrok pada rentang VALID → kosongkan pilihan
  // (JANGAN diam-diam ganti mobil lain — bisa salah pesan). Rentang transien tidak
  // valid (saat user sedang mengedit jam) diabaikan agar pilihan tidak hilang.
  useEffect(() => {
    if (!draft || !validRange) return;
    if (!slotVehicles.some((v) => v.id === modalVehicleId)) {
      setModalVehicleId('');
    }
  }, [draft, validRange, slotVehicles, modalVehicleId]);

  const submitBooking = async () => {
    if (!modalVehicleId || !purpose.trim() || !validRange) return;
    setSubmitting(true);
    try {
      const data = await sendJson('/api/bookings', 'POST', {
        vehicle_id: modalVehicleId,
        start_time: draft.start.toISOString(),
        end_time: draft.end.toISOString(),
        purpose: purpose.trim(),
      });
      setDraft(null);
      setToast({ message: `Booking berhasil diajukan! Status: ${data.status || 'Pending'}`, type: 'success' });
      fetchBookings();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelBooking = async (id) => {
    setCancelling(true);
    try {
      await sendJson(`/api/bookings/${id}`, 'PATCH', { action: 'CANCEL' });
      setDetail(null);
      setToast({ message: 'Booking dibatalkan.', type: 'success' });
      fetchBookings();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const canCancel =
    detail && user && detail.requester_id === user.id && ACTIVE_STATUSES.includes(detail.status);

  const selectedVehicle = slotVehicles.find((v) => v.id === modalVehicleId) || null;
  const shiftDay = (n) => setDate((d) => startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-4">
      <PageHeader
        eyebrow="Booking"
        title="Booking Kendaraan"
        subtitle={
          user
            ? `Seret rentang waktu pada baris kendaraan yang tersedia — atas nama ${user.name}.`
            : 'Seret rentang waktu pada baris kendaraan yang tersedia.'
        }
      />

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {errorMsg && (
        <div className="mb-6 p-4 rounded-[var(--radius)] border border-[var(--danger-line)] bg-[var(--danger-wash)] text-[var(--danger)] text-sm">
          {errorMsg}
        </div>
      )}

      <Reveal className="panel">
        {/* Navigasi tanggal */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-b border-[var(--line)]">
          <Button variant="ghost" size="sm" onClick={() => setDate(startOfDay(new Date()))}>
            Hari Ini
          </Button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftDay(-1)}
              aria-label="Hari sebelumnya"
              className="grid place-items-center w-8 h-8 rounded-full border border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => shiftDay(1)}
              aria-label="Hari berikutnya"
              className="grid place-items-center w-8 h-8 rounded-full border border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <input
            type="date"
            className="field !w-auto !min-h-0 py-1.5 text-sm"
            value={toLocalDate(date)}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split('-').map(Number);
              if (y && m && d) setDate(new Date(y, m - 1, d));
            }}
          />
          <span className="font-display text-lg text-[var(--ink)] ml-auto">
            {date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="p-3 sm:p-5">
          <VehicleTimeline
            vehicles={vehicles}
            events={events}
            date={date}
            eventColor={getEventColor}
            onSelectRange={handleSelectRange}
            onEventClick={(b) => setDetail(b)}
          />
        </div>
      </Reveal>

      {draft && (
        <div className="fixed inset-0 bg-[var(--ink)]/40 flex items-center justify-center p-4 z-50">
          <div className="panel w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" data-lenis-prevent>
            <h2 className="font-display text-2xl text-[var(--ink)] mb-5">Ajukan Booking</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1.5">Mulai</label>
                <input
                  type="datetime-local"
                  className="field mb-4 text-sm"
                  value={toLocalInput(draft.start)}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!Number.isNaN(d.getTime())) setDraft((prev) => ({ ...prev, start: d }));
                  }}
                />
              </div>
              <div>
                <label className="label block mb-1.5">Selesai</label>
                <input
                  type="datetime-local"
                  className="field mb-4 text-sm"
                  value={toLocalInput(draft.end)}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!Number.isNaN(d.getTime())) setDraft((prev) => ({ ...prev, end: d }));
                  }}
                />
              </div>
            </div>
            {!validRange && (
              <p className="text-xs text-[var(--danger)] -mt-2 mb-4">Waktu selesai harus setelah waktu mulai.</p>
            )}

            <label className="label block mb-1.5">Kendaraan tersedia</label>
            {validRange && slotVehicles.length === 0 ? (
              <div className="mb-4 p-3 rounded-[10px] border border-[var(--line)] bg-[var(--mist)] text-sm text-[var(--ink-2)]">
                Tidak ada kendaraan tersedia untuk jam ini. Coba jam/tanggal lain.
              </div>
            ) : (
              <>
                <select
                  className="field mb-2 text-sm"
                  value={modalVehicleId}
                  onChange={(e) => setModalVehicleId(e.target.value)}
                >
                  {!modalVehicleId && <option value="">— pilih kendaraan —</option>}
                  {slotVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.license_plate})
                    </option>
                  ))}
                </select>
                {validRange && slotVehicles.length > 0 && !modalVehicleId && (
                  <p className="text-xs text-[var(--danger)] mb-2">
                    Kendaraan sebelumnya bentrok pada jam ini — pilih kendaraan lain.
                  </p>
                )}
              </>
            )}

            {selectedVehicle && (
              <div className="mb-4 rounded-[10px] border border-[var(--line)] bg-[var(--mist)] p-3">
                {vehicleSpecText(selectedVehicle) && (
                  <p className="mono text-[11px] uppercase tracking-[0.1em] text-[var(--blue)]">
                    {vehicleSpecText(selectedVehicle)}
                  </p>
                )}
                {selectedVehicle.notes && (
                  <p className="text-[var(--ink-2)] text-xs mt-1.5">Catatan: {selectedVehicle.notes}</p>
                )}
                {!vehicleSpecText(selectedVehicle) && !selectedVehicle.notes && (
                  <p className="text-[var(--muted)] text-xs">Belum ada info tambahan untuk kendaraan ini.</p>
                )}
              </div>
            )}

            <label className="label block mb-1.5">Keperluan</label>
            <textarea
              className="field mb-5 text-sm"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Contoh: Antar dokumen ke kantor cabang"
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={submitting}>Batal</Button>
              <Button
                variant="primary"
                arrow
                onClick={submitBooking}
                disabled={submitting || !modalVehicleId || !purpose.trim() || !validRange}
              >
                {submitting ? 'Mengirim' : 'Ajukan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-[var(--ink)]/40 flex items-center justify-center p-4 z-50">
          <div className="panel w-full max-w-md p-6">
            <h2 className="font-display text-2xl text-[var(--ink)] mb-4">Detail Booking</h2>
            <div className="text-sm text-[var(--ink-2)] space-y-2.5 mb-5">
              <p><span className="label">Kendaraan</span><br />{detail.vehicle_name} {detail.license_plate ? `(${detail.license_plate})` : ''}</p>
              <div>
                <span className="label">Pemohon</span>
                <div className="flex items-center gap-2 mt-1 text-[var(--ink)]">
                  <Avatar src={detail.requester_avatar} name={detail.user_name} size={24} />
                  {detail.user_name}{detail.requester_department ? ` — ${detail.requester_department}` : ''}
                </div>
              </div>
              <p><span className="label">Waktu</span><br /><span className="num">{fmt(detail.start_time?.value)} &rarr; {fmt(detail.end_time?.value)}</span></p>
              <p><span className="label">Keperluan</span><br />{detail.purpose}</p>
              <div className="flex items-center gap-2"><span className="label">Status</span> <StatusBadge status={detail.status} /></div>
              <div className="text-xs text-[var(--muted)]"><AuditLine b={detail} size={18} /></div>
              {vehicleChangeNote(detail) && (
                <p className="text-xs text-[var(--danger)] bg-[var(--danger-wash)] border border-[var(--danger-line)] rounded-[10px] p-2.5">
                  {vehicleChangeNote(detail)}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center gap-2">
              {canCancel ? (
                <Button variant="danger" onClick={() => cancelBooking(detail.id)} disabled={cancelling}>
                  {cancelling ? 'Membatalkan' : 'Batalkan Booking'}
                </Button>
              ) : (
                <span />
              )}
              <Button variant="ghost" onClick={() => setDetail(null)}>Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
