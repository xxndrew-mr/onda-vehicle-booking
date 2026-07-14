// =============================================================================
// HALAMAN SECURITY DINONAKTIFKAN SEMENTARA (fitur belum dipakai).
// Untuk mengaktifkan kembali: hapus stub di bawah, lalu hapus blok komentar
// besar di bawahnya (kode asli tetap utuh). Aktifkan juga link "Security" di
// src/components/Navbar.js.
// =============================================================================

export default function SecurityDisabled() {
  return (
    <div className="p-8 min-h-[60vh] flex items-center justify-center">
      <div className="text-center text-gray-500">
        <p className="text-lg font-semibold">Halaman Security dinonaktifkan sementara.</p>
        <p className="text-sm mt-1">Fitur ini belum digunakan.</p>
      </div>
    </div>
  );
}

/* ===== KODE ASLI (dinonaktifkan) — jangan hapus =====
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, MapPin, User } from 'lucide-react';
import { getJson } from '../lib/api';

// Booking "aktif hari ini" = disetujui DAN jendela waktunya beririsan dengan hari ini.
function isActiveToday(b) {
  const start = b.start_time?.value ? new Date(b.start_time.value) : null;
  const end = b.end_time?.value ? new Date(b.end_time.value) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return start < dayEnd && end >= dayStart;
}

export default function SecurityDashboard() {
  const [approvedList, setApprovedList] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getJson('/api/bookings')
      .then((data) => {
        setErrorMsg('');
        const list = data
          .filter((b) => b.status === 'Approved' && isActiveToday(b))
          .sort((a, b) => new Date(a.start_time.value) - new Date(b.start_time.value));
        setApprovedList(list);
      })
      .catch((err) => setErrorMsg(err.message));
  }, []);

  const fmt = (t) => (t?.value ? new Date(t.value).toLocaleString('id-ID') : '-');

  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-700 pb-4">
          <ShieldCheck size={40} className="text-green-400" />
          <div>
            <h1 className="text-3xl font-bold">Security Gate Monitoring</h1>
            <p className="text-slate-400">
              Kendaraan Keluar Hari Ini &mdash; PT. Onda Mega Integra
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-4 bg-red-900/40 border border-red-500 text-red-200 rounded-lg">
            <span className="font-semibold">Gagal memuat data:</span> {errorMsg}
          </div>
        )}

        {!errorMsg && approvedList.length === 0 && (
          <div className="bg-slate-800 p-10 text-center text-slate-400 rounded-lg">
            Tidak ada kendaraan terjadwal keluar hari ini.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {approvedList.map((item) => (
            <div key={item.id} className="bg-slate-800 border-l-4 border-green-500 p-5 rounded-lg shadow-lg">
              <div className="flex justify-between items-start mb-3">
                <span className="text-2xl font-mono font-bold text-green-400">
                  {item.license_plate || '—'}
                </span>
                <span className="bg-green-900 text-green-300 text-xs px-2 py-1 rounded">AUTHORIZED</span>
              </div>
              <h3 className="text-xl font-bold mb-2">{item.vehicle_name}</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2"><User size={14} /> Driver/User: {item.user_name}{item.requester_department ? ` (${item.requester_department})` : ''}</div>
                <div className="flex items-center gap-2"><Clock size={14} /> {fmt(item.start_time)} &rarr; {fmt(item.end_time)}</div>
                <div className="flex items-center gap-2"><MapPin size={14} /> Tujuan: {item.purpose}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
===== AKHIR KODE ASLI ===== */
