import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getJson, sendJson } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import { StatusBadge, AuditLine, vehicleChangeNote, ACTIVE_STATUSES, fmtTs } from '../components/BookingStatus';
import { isVehicleAvailable, vehicleSpecText } from '../lib/vehicleStatus';
import { CalendarDays } from 'lucide-react';
import Avatar from '../components/Avatar';
import Toast from '../components/Toast';
import PageHeader from '../components/PageHeader';

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
    <div className="p-6 sm:p-8">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-xl shadow-sm ring-1 ring-gray-100">
        <PageHeader
          icon={CalendarDays}
          title="Booking Kendaraan"
          subtitle={
            user
              ? `Pilih rentang waktu di kalender, lalu pilih kendaraan tersedia — atas nama ${user.name}.`
              : 'Pilih rentang waktu di kalender, lalu pilih kendaraan yang tersedia.'
          }
        />

        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'success' })}
        />

        {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg">
            <span className="font-semibold">Perhatian:</span> {errorMsg}
          </div>
        )}

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
      </div>

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-blue-900 mb-1">Ajukan Booking</h2>
            <p className="text-sm text-gray-500 mb-4">
              {fmt(draft.start)} &rarr; {fmt(draft.end)}
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">Kendaraan tersedia</label>
            {slotVehicles.length === 0 ? (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm">
                Tidak ada kendaraan tersedia untuk jam ini. Coba jam/tanggal lain.
              </div>
            ) : (
              <select
                className="w-full border rounded-md p-2 mb-2 text-sm"
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
              <div className="mb-4 rounded-md bg-blue-50 border border-blue-100 p-3 text-sm">
                {vehicleSpecText(selectedVehicle) && (
                  <p className="text-blue-900 font-medium">{vehicleSpecText(selectedVehicle)}</p>
                )}
                {selectedVehicle.notes && (
                  <p className="text-gray-600 text-xs mt-1">Catatan: {selectedVehicle.notes}</p>
                )}
                {!vehicleSpecText(selectedVehicle) && !selectedVehicle.notes && (
                  <p className="text-gray-400 text-xs">Belum ada info tambahan untuk kendaraan ini.</p>
                )}
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1">Keperluan</label>
            <textarea
              className="w-full border rounded-md p-2 mb-4 text-sm"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Contoh: Antar dokumen ke kantor cabang"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDraft(null)}
                disabled={submitting}
                className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={submitBooking}
                disabled={submitting || !modalVehicleId || !purpose.trim()}
                className="px-4 py-2 rounded-md bg-blue-700 text-white hover:bg-blue-800 transition disabled:opacity-50"
              >
                {submitting ? 'Mengirim…' : 'Ajukan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-blue-900 mb-1">Detail Booking</h2>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              <p><span className="font-medium">Kendaraan:</span> {detail.vehicle_name} {detail.license_plate ? `(${detail.license_plate})` : ''}</p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Pemohon:</span>
                <Avatar src={detail.requester_avatar} name={detail.user_name} size={22} />
                {detail.user_name}{detail.requester_department ? ` — ${detail.requester_department}` : ''}
              </p>
              <p><span className="font-medium">Waktu:</span> {fmt(detail.start_time?.value)} &rarr; {fmt(detail.end_time?.value)}</p>
              <p><span className="font-medium">Keperluan:</span> {detail.purpose}</p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Status:</span> <StatusBadge status={detail.status} />
              </p>
              <div className="text-xs text-gray-400"><AuditLine b={detail} size={18} /></div>
              {vehicleChangeNote(detail) && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  {vehicleChangeNote(detail)}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center gap-2">
              {canCancel ? (
                <button
                  onClick={() => cancelBooking(detail.id)}
                  disabled={cancelling}
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
                >
                  {cancelling ? 'Membatalkan…' : 'Batalkan Booking'}
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setDetail(null)}
                className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
