import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Car, CalendarDays, ClipboardCheck, Truck, History, RotateCcw, User } from 'lucide-react';
// ShieldCheck (menu Security) dinonaktifkan sementara — lihat link di bawah.
import { useAuth } from './AuthContext';

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  GA: 'General Affairs',
  GM: 'General Manager',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

export default function Navbar() {
  const { pathname } = useRouter();
  const { user } = useAuth();
  const [resetting, setResetting] = useState(false);

  // Menu Approval hanya untuk yang benar-benar bisa menyetujui:
  // supervisor (leader divisi di Lark / punya bawahan) atau GA/Admin.
  const canApprove =
    !!user && (user.is_supervisor || user.role === 'GA' || user.role === 'ADMIN');
  // Manajemen armada khusus GA (ADMIN sebagai superuser juga diberi akses).
  const isGa = !!user && (user.role === 'GA' || user.role === 'ADMIN');

  const links = [
    { href: '/', label: 'Booking', icon: CalendarDays, show: true },
    { href: '/riwayat', label: 'Riwayat', icon: History, show: true },
    { href: '/approval', label: 'Approval', icon: ClipboardCheck, show: canApprove },
    { href: '/armada', label: 'Armada', icon: Truck, show: isGa },
    // Menu Security dinonaktifkan sementara (fitur belum dipakai):
    // { href: '/security', label: 'Security', icon: ShieldCheck, show: true },
  ].filter((l) => l.show);

  // Reset Session: ambil ulang data terbaru dari Lark (role/atasan/departemen)
  // tanpa login ulang. Overlay loading tampil seketika sebagai feedback.
  const resetSession = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await fetch('/api/auth/refresh', { method: 'POST' });
    } catch {
      // abaikan — reload tetap dilakukan agar UI kembali sinkron
    }
    window.location.reload(); // muat ulang dengan session terbaru
  };

  return (
    <>
    {/* Floating: menempel di atas (sticky) dengan jarak dari tepi + pill melayang. */}
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className="max-w-6xl mx-auto bg-blue-900/90 backdrop-blur-md text-white rounded-2xl shadow-lg shadow-blue-900/20 ring-1 ring-white/10">
        <div className="px-4 sm:px-5 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold shrink-0">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-white/10">
              <Car size={18} />
            </span>
            <span className="hidden sm:inline">Car Booking &mdash; PT. Onda Mega Integra</span>
            <span className="sm:hidden">Car Booking</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
                    pathname === href
                      ? 'bg-white text-blue-900 font-semibold shadow-sm'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              ))}
            </div>

            {user && (
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-white/15">
                <span className="grid place-items-center w-8 h-8 rounded-full bg-white/10 shrink-0">
                  <User size={16} />
                </span>
                <div className="text-sm leading-tight hidden sm:block">
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-blue-200">
                    {ROLE_LABELS[user.role] || user.role}
                    {user.department ? ` · ${user.department}` : ''}
                  </div>
                </div>
                <button
                  onClick={resetSession}
                  disabled={resetting}
                  title="Reset Session — ambil ulang data terbaru dari Lark"
                  className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition text-sm disabled:opacity-60"
                >
                  <RotateCcw size={16} className={resetting ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Reset Session</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>

    {/* Overlay loading — muncul SEKETIKA saat Reset Session ditekan (feedback instan). */}
    {resetting && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
        <div className="bg-white rounded-xl shadow-xl px-8 py-7 flex flex-col items-center gap-3 text-gray-800">
          <RotateCcw size={30} className="animate-spin text-blue-700" />
          <p className="font-semibold">Mereset session…</p>
          <p className="text-xs text-gray-500">Mengambil data terbaru dari Lark</p>
        </div>
      </div>
    )}
    </>
  );
}
