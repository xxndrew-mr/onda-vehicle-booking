import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getJson, sendJson } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import { StatusBadge, AuditLine, vehicleChangeNote, ACTIVE_STATUSES, fmtTs } from '../components/BookingStatus';
import { isVehicleAvailable, vehicleSpecText } from '../lib/vehicleStatus';
import Avatar from '../components/Avatar';
import Toast from '../components/Toast';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Reveal from '../components/Reveal';

// Kalender hanya menampilkan booking AKTIF (Pending/Approved). Rejected & Cancelled
// disembunyikan dari kalender (slot bebas) — record tetap ada di Riwayat user.
const isActiveBooking = (status) => {
  const s = String(status || '');
  return !s.includes('Rejected') && !s.includes('Cancelled');
};

const getEventColor = (status) => (status === 'Approved' ? '#22c55e' : '#f59e0b'); // hijau / kuning

const fmt = fmtTs;

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [vehicles, setVehicles] = useState([]); // hanya kendaraan Ready
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Modal booking: pilih kendaraan setelah menentukan jam.
  const [draft, setDraft] = useState(null); // { start, end }
  const [modalVehicleId, setModalVehicleId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal detail + pembatalan booking.
  const [detail, setDetail] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = useCallback(() => {
    getJson('/api/bookings')
      .then((data) => {
        const formatted = data
          .filter((b) => b.start_time?.value && b.end_time?.value && isActiveBooking(b.status))
          .map((b) => ({
            id: b.id,
            title: `${b.vehicle_name} - ${b.user_name}`,
            start: b.start_time.value,
            end: b.end_time.value,
            backgroundColor: getEventColor(b.status),
            extendedProps: { ...b },
          }));
        setErrorMsg('');
        setEvents(formatted);
      })
      .catch((err) => setErrorMsg(err.message));
  }, []);

  useEffect(() => {
    fetchBookings();
    getJson('/api/vehicles')
      .then((data) => setVehicles(data.filter((v) => isVehicleAvailable(v.status))))
      .catch((err) => setErrorMsg(err.message));
  }, [fetchBookings]);

  // Kendaraan Ready yang BEBAS pada rentang waktu [start, end) — yang sudah dibooking
  // atau sedang menunggu approval untuk jam yang tumpang-tindih tidak ikut.
  const vehiclesFreeForSlot = useCallback(
    (start, end) => {
      const s = new Date(start);
      const e = new Date(end);
      return vehicles.filter((v) => {
        const conflict = events.some(
          (ev) =>
            ev.extendedProps.vehicle_id === v.id &&
            new Date(ev.start) < e &&
            new Date(ev.end) > s
        );
        return !conflict;
      });
    },
    [vehicles, events]
  );

  const handleDateSelect = (selectInfo) => {
    const free = vehiclesFreeForSlot(selectInfo.startStr, selectInfo.endStr);
    setPurpose('');
    setModalVehicleId(free.length > 0 ? free[0].id : '');
    setDraft({ start: selectInfo.startStr, end: selectInfo.endStr });
  };

  const submitBooking = async () => {
    if (!modalVehicleId || !purpose.trim()) return;
    setSubmitting(true);
    try {
      const data = await sendJson('/api/bookings', 'POST', {
        vehicle_id: modalVehicleId,
        start_time: draft.start,
        end_time: draft.end,
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

  const slotVehicles = draft ? vehiclesFreeForSlot(draft.start, draft.end) : [];
  const selectedVehicle = slotVehicles.find((v) => v.id === modalVehicleId) || null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-4">
      <PageHeader
        eyebrow="Booking"
        title="Booking Kendaraan"
        subtitle={
          user
            ? `Pilih rentang waktu di kalender, lalu pilih kendaraan tersedia — atas nama ${user.name}.`
            : 'Pilih rentang waktu di kalender, lalu pilih kendaraan yang tersedia.'
        }
      />

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {errorMsg && (
        <div className="mb-6 p-4 rounded-[var(--radius)] border border-[var(--danger-line)] bg-[var(--danger-wash)] text-[var(--danger)] text-sm">
          {errorMsg}
        </div>
      )}

      <Reveal className="panel p-3 sm:p-5">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          timeZone="local"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          selectable={true}
          selectAllow={(span) => !span.allDay}
          select={handleDateSelect}
          events={events}
          eventClick={(info) => setDetail(info.event.extendedProps)}
          height="70vh"
        />
      </Reveal>

      {draft && (
        <div className="fixed inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="panel w-full max-w-md p-6">
            <h2 className="font-display text-2xl text-[var(--ink)]">Ajukan Booking</h2>
            <p className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mt-1 mb-5">
              {fmt(draft.start)} &rarr; {fmt(draft.end)}
            </p>

            <label className="label block mb-1.5">Kendaraan tersedia</label>
            {slotVehicles.length === 0 ? (
              <div className="mb-4 p-3 rounded-[10px] border border-[var(--line)] bg-[var(--mist)] text-sm text-[var(--ink-2)]">
                Tidak ada kendaraan tersedia untuk jam ini. Coba jam/tanggal lain.
              </div>
            ) : (
              <select
                className="field mb-2 text-sm"
                value={modalVehicleId}
                onChange={(e) => setModalVehicleId(e.target.value)}
                autoFocus
              >
                {slotVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.license_plate})
                  </option>
                ))}
              </select>
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
                disabled={submitting || !modalVehicleId || !purpose.trim()}
              >
                {submitting ? 'Mengirim' : 'Ajukan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
