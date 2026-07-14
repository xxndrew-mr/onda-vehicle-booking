import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getJson, sendJson } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import { StatusBadge, auditInfo, vehicleChangeNote, ACTIVE_STATUSES, fmtTs } from '../components/BookingStatus';
import { isVehicleAvailable } from '../lib/vehicleStatus';

const getEventColor = (status) => {
  const s = String(status || '');
  if (s.includes('Rejected')) return '#ef4444'; // Merah
  if (s.includes('Cancelled')) return '#9ca3af'; // Abu-abu (dibatalkan)
  if (s === 'Approved') return '#22c55e'; // Hijau (Done)
  return '#f59e0b'; // Kuning (Pending/Process)
};

const fmt = fmtTs;

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');

  // Modal booking (pengganti window.prompt yang tidak selalu ada di webview Lark).
  const [draft, setDraft] = useState(null); // { start, end }
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal detail + pembatalan booking.
  const [detail, setDetail] = useState(null); // extendedProps booking
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = useCallback(() => {
    getJson('/api/bookings')
      .then((data) => {
        const formatted = data
          .filter((b) => b.start_time?.value && b.end_time?.value)
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
      .then((data) => {
        // Hanya kendaraan tersedia (Ready) yang bisa dipesan — status diatur GA.
        const available = data.filter((v) => isVehicleAvailable(v.status));
        setVehicles(available);
        if (available.length > 0) setVehicleId((prev) => prev || available[0].id);
      })
      .catch((err) => setErrorMsg(err.message));
  }, [fetchBookings]);

  const handleDateSelect = (selectInfo) => {
    if (!vehicleId) {
      setErrorMsg('Pilih kendaraan terlebih dahulu.');
      return;
    }
    setPurpose('');
    setDraft({ start: selectInfo.startStr, end: selectInfo.endStr });
  };

  const submitBooking = async () => {
    if (!purpose.trim()) return;
    setSubmitting(true);
    try {
      const data = await sendJson('/api/bookings', 'POST', {
        vehicle_id: vehicleId,
        start_time: draft.start,
        end_time: draft.end,
        purpose: purpose.trim(),
      });
      setDraft(null);
      setNotice(`Booking berhasil diajukan! Status: ${data.status || 'Pending'}`);
      fetchBookings();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelBooking = async (id) => {
    setCancelling(true);
    try {
      await sendJson(`/api/bookings/${id}`, 'PATCH', { action: 'CANCEL' });
      setDetail(null);
      setNotice('Booking dibatalkan.');
      fetchBookings();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const canCancel =
    detail && user && detail.requester_id === user.id && ACTIVE_STATUSES.includes(detail.status);

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-xl shadow-sm ring-1 ring-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Booking Kendaraan</h1>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            Kendaraan:
            <select
              className="p-2 border rounded shadow-sm"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              {vehicles.length === 0 && <option value="">— tidak ada data —</option>}
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.license_plate})
                </option>
              ))}
            </select>
          </label>
        </div>

        {user && (
          <p className="mb-4 text-sm text-gray-500">
            Booking dibuat atas nama <span className="font-semibold">{user.name}</span> — pilih rentang
            waktu di kalender (tampilan Minggu/Hari) untuk mengajukan.
          </p>
        )}

        {notice && (
          <div className="mb-4 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg">
            {notice}
          </div>
        )}

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
          // Hindari seleksi date-only di tampilan bulan (menggeser jam karena zona waktu).
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

            <label className="block text-sm font-medium text-gray-700 mb-1">Keperluan</label>
            <textarea
              className="w-full border rounded-md p-2 mb-4 text-sm"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Contoh: Antar dokumen ke kantor cabang"
              autoFocus
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
                disabled={submitting || !purpose.trim()}
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
              <p><span className="font-medium">Pemohon:</span> {detail.user_name}{detail.requester_department ? ` — ${detail.requester_department}` : ''}</p>
              <p><span className="font-medium">Waktu:</span> {fmt(detail.start_time?.value)} &rarr; {fmt(detail.end_time?.value)}</p>
              <p><span className="font-medium">Keperluan:</span> {detail.purpose}</p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Status:</span> <StatusBadge status={detail.status} />
              </p>
              {auditInfo(detail) && (
                <p className="text-xs text-gray-400">{auditInfo(detail)}</p>
              )}
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
