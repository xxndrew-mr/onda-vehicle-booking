import { useState, useRef, useEffect } from 'react';
import { isVehicleAvailable, VEHICLE_STATUS_META, vehicleSpecText } from '../lib/vehicleStatus';

/**
 * Timeline harian ala booking room Lark: daftar kendaraan di kiri (sticky),
 * sumbu jam ke kanan, blok booking di tiap baris. Seret (drag) horizontal di
 * baris kendaraan Ready untuk memilih rentang waktu (snap 30 menit); di layar
 * sentuh cukup TAP → slot 1 jam (waktu bisa disesuaikan di modal).
 *
 * Presentasi murni — data & aksi lewat props:
 *   vehicles      : semua kendaraan (baris; non-Ready tampil redup, tak bisa dipilih)
 *   events        : booking aktif [{ id, vehicle_id, start:Date, end:Date, status, user_name, purpose, raw }]
 *   date          : Date (00:00 lokal) hari yang ditampilkan
 *   eventColor    : (status) => warna blok
 *   onSelectRange : (vehicle, startDate, endDate) => buka modal booking
 *   onEventClick  : (rawBooking) => buka modal detail
 */

const HOUR_W = 72; // px per jam
const LEFT_W = 176; // lebar kolom kendaraan
const SNAP = 30; // menit
const DAY_MIN = 24 * 60;
const ROW_H = 56;

const pad = (n) => String(n).padStart(2, '0');
const fmtMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const clampMin = (m) => Math.max(0, Math.min(DAY_MIN, m));

// Latar grid: garis tiap jam + garis tipis tiap 30 menit.
const GRID_BG = {
  backgroundImage:
    `repeating-linear-gradient(to right, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${HOUR_W}px),` +
    `repeating-linear-gradient(to right, transparent 0, transparent ${HOUR_W / 2}px, #F0F2F8 ${HOUR_W / 2}px, #F0F2F8 ${HOUR_W / 2 + 1}px, transparent ${HOUR_W / 2 + 1}px, transparent ${HOUR_W}px)`,
};

export default function VehicleTimeline({ vehicles, events, date, eventColor, onSelectRange, onEventClick }) {
  const scrollRef = useRef(null);
  const [drag, setDrag] = useState(null); // { vid, anchor, start, end, moved }
  const [nowMin, setNowMin] = useState(() => minutesToday(date));

  const dayStart = date;
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const isToday = nowMin != null;
  // Menit wall-clock (0..1440) sebuah waktu relatif ke hari yang ditampilkan;
  // di-clamp untuk booking yang melewati tengah malam. Konsisten dengan label jam
  // & garis "sekarang" (sama-sama wall-clock) — aman di hari transisi DST.
  const minsOf = (t) => (t <= dayStart ? 0 : t >= dayEnd ? DAY_MIN : t.getHours() * 60 + t.getMinutes());

  // Garis "sekarang" bergeser tiap menit (hanya saat melihat hari ini).
  useEffect(() => {
    setNowMin(minutesToday(date));
    const t = setInterval(() => setNowMin(minutesToday(date)), 60_000);
    return () => clearInterval(t);
  }, [date]);

  // Scroll awal: ke sekitar jam sekarang (hari ini) atau jam kerja (07:00).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = nowMin != null ? Math.max(0, nowMin - 90) : 7 * 60;
    el.scrollLeft = (target / 60) * HOUR_W;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const minToDate = (m) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, m);
  const posToMin = (e, el, round) => {
    const x = e.clientX - el.getBoundingClientRect().left;
    const raw = (x / HOUR_W) * 60;
    const snapped = round ? Math.round(raw / SNAP) * SNAP : Math.floor(raw / SNAP) * SNAP;
    return clampMin(snapped);
  };

  const startDrag = (e, v) => {
    if (!isVehicleAvailable(v.status)) return;
    if (e.button != null && e.button !== 0) return; // hanya klik kiri
    if (e.target.closest('[data-ev]')) return; // klik blok booking → detail
    const m = posToMin(e, e.currentTarget, false);
    if (m >= DAY_MIN) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
    setDrag({ vid: v.id, anchor: m, start: m, end: Math.min(DAY_MIN, m + SNAP), moved: false });
  };

  const moveDrag = (e, v) => {
    if (!drag || drag.vid !== v.id) return;
    const c = posToMin(e, e.currentTarget, true);
    const start = Math.min(drag.anchor, c);
    const end = Math.max(drag.anchor + SNAP, c);
    setDrag((d) => (d ? { ...d, start, end, moved: d.moved || c !== d.anchor } : d));
  };

  const endDrag = (e, v) => {
    if (!drag || drag.vid !== v.id) return;
    let { start, end, moved, anchor } = drag;
    setDrag(null);
    if (!moved) {
      // Tap/klik tanpa seret → slot 1 jam dari titik yang disentuh.
      start = anchor;
      end = Math.min(DAY_MIN, anchor + 60);
    }
    // Kunci pilihan ke CELAH KOSONG di sekitar anchor pada baris ini — tidak boleh
    // menembus booking yang sudah ada (jadi tidak mungkin salah mesan mobil lain;
    // server tetap validasi 409). Anchor selalu di ruang kosong karena pointerdown
    // di atas blok booking diabaikan.
    let lower = 0;
    let upper = DAY_MIN;
    for (const ev of events) {
      if (ev.vehicle_id !== v.id) continue;
      const es = minsOf(ev.start);
      const ee = minsOf(ev.end);
      if (ee <= anchor) lower = Math.max(lower, ee);
      if (es >= anchor) upper = Math.min(upper, es);
    }
    start = Math.max(start, lower);
    end = Math.min(end, upper);
    if (end - start < SNAP) return;
    onSelectRange(v, minToDate(start), minToDate(end));
  };

  const cancelDrag = () => setDrag(null);

  if (!vehicles.length) {
    return <p className="text-sm text-[var(--muted)] text-center py-10">Belum ada kendaraan terdaftar.</p>;
  }

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto select-none" data-lenis-prevent>
        <div style={{ minWidth: LEFT_W + 24 * HOUR_W }}>
          {/* Header jam */}
          <div className="flex">
            <div
              className="sticky left-0 z-20 bg-[var(--paper)] border-b border-r border-[var(--line)] flex items-end pb-1.5 px-3"
              style={{ width: LEFT_W, minWidth: LEFT_W }}
            >
              <span className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Kendaraan</span>
            </div>
            <div className="relative h-8 border-b border-[var(--line)]" style={{ width: 24 * HOUR_W, ...GRID_BG }}>
              {Array.from({ length: 24 }, (_, h) => (
                <span
                  key={h}
                  className="absolute bottom-1 mono text-[10px] text-[var(--muted)] pl-1"
                  style={{ left: h * HOUR_W }}
                >
                  {pad(h)}:00
                </span>
              ))}
              {isToday && <NowLine min={nowMin} withDot />}
            </div>
          </div>

          {/* Baris kendaraan */}
          {vehicles.map((v) => {
            const ready = isVehicleAvailable(v.status);
            const meta = VEHICLE_STATUS_META[v.status];
            const blocks = events.filter(
              (ev) => ev.vehicle_id === v.id && ev.end > dayStart && ev.start < dayEnd
            );
            return (
              <div className="flex" key={v.id}>
                <div
                  className={`sticky left-0 z-20 border-b border-r border-[var(--line)] px-3 py-2 ${
                    ready ? 'bg-[var(--paper)]' : 'bg-[var(--mist)]'
                  }`}
                  style={{ width: LEFT_W, minWidth: LEFT_W, height: ROW_H }}
                >
                  <div className="text-[13px] font-medium text-[var(--ink)] truncate leading-tight">{v.name}</div>
                  <div className="mono text-[10px] text-[var(--muted)] truncate">
                    {ready
                      ? [v.license_plate, vehicleSpecText(v)].filter(Boolean).join(' · ') || '—'
                      : (meta?.label || v.status)}
                  </div>
                </div>
                <div
                  className={`relative border-b border-[var(--line)] ${
                    ready ? 'cursor-crosshair' : 'bg-[var(--mist)]/60 cursor-not-allowed'
                  }`}
                  style={{ width: 24 * HOUR_W, height: ROW_H, touchAction: 'pan-x pan-y', ...GRID_BG }}
                  onPointerDown={ready ? (e) => startDrag(e, v) : undefined}
                  onPointerMove={ready ? (e) => moveDrag(e, v) : undefined}
                  onPointerUp={ready ? (e) => endDrag(e, v) : undefined}
                  onPointerCancel={ready ? cancelDrag : undefined}
                >
                  {blocks.map((ev) => {
                    const s = minsOf(ev.start);
                    const en = minsOf(ev.end);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        data-ev
                        onClick={() => onEventClick(ev.raw)}
                        title={`${ev.user_name} — ${ev.purpose || ''}`}
                        className="absolute top-1.5 bottom-1.5 rounded-md px-1.5 text-left text-[11px] font-medium text-white truncate shadow-sm hover:brightness-95 transition"
                        style={{
                          left: (s / 60) * HOUR_W,
                          width: Math.max(((en - s) / 60) * HOUR_W, 14),
                          backgroundColor: eventColor(ev.status),
                        }}
                      >
                        {ev.user_name}
                      </button>
                    );
                  })}

                  {drag && drag.vid === v.id && (
                    <div
                      className="absolute top-1 bottom-1 rounded-md border-2 border-[var(--blue)] bg-[var(--blue-wash)]/80 z-10 flex items-center justify-center pointer-events-none"
                      style={{ left: (drag.start / 60) * HOUR_W, width: ((drag.end - drag.start) / 60) * HOUR_W }}
                    >
                      {drag.end - drag.start >= 60 && (
                        <span className="mono text-[10px] font-bold text-[var(--blue)] whitespace-nowrap">
                          {fmtMin(drag.start)}–{fmtMin(drag.end)}
                        </span>
                      )}
                    </div>
                  )}

                  {isToday && <NowLine min={nowMin} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda + petunjuk */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4">
        <Legend color="#22c55e" label="Disetujui" />
        <Legend color="#f59e0b" label="Menunggu approval" />
        <span className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
          Seret di baris mobil untuk pilih waktu · di HP: tap = 1 jam · klik blok untuk detail
        </span>
      </div>
    </div>
  );
}

function minutesToday(date) {
  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  return sameDay ? now.getHours() * 60 + now.getMinutes() : null;
}

function NowLine({ min, withDot = false }) {
  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-[var(--danger)] z-10 pointer-events-none"
      style={{ left: (min / 60) * HOUR_W }}
    >
      {withDot && <span className="absolute -top-0.5 -left-[3px] w-[7px] h-[7px] rounded-full bg-[var(--danger)]" />}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-2)]">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
