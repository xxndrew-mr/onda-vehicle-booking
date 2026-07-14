import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Car, CalendarDays, ClipboardCheck, Truck, History, RotateCcw } from 'lucide-react';
// ShieldCheck (menu Security) dinonaktifkan sementara — lihat link di bawah.
import { useAuth } from './AuthContext';
import Avatar from './Avatar';

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
    {/* Floating: menempel di atas (sticky), pill putih dengan hairline. */}
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className="max-w-6xl mx-auto bg-[var(--paper)]/85 backdrop-blur-md border border-[var(--line)] rounded-[var(--radius)] shadow-[0_16px_40px_-26px_rgba(11,16,32,0.4)]">
        <div className="px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--blue)] text-white">
              <Car size={17} />
            </span>
            <span className="hidden lg:block font-display text-[18px] text-[var(--ink)]">Car Booking</span>
          </Link>

          {/* Menu */}
          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                  pathname === href
                    ? 'bg-[var(--blue-wash)] text-[var(--blue)]'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon size={15} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
          </div>

          {/* User + Reset */}
          {user && (
            <div className="flex items-center gap-2.5 shrink-0 pl-2 sm:pl-3 border-l border-[var(--line)]">
              <div className="text-right leading-tight hidden md:block max-w-[9rem]">
                <div className="text-sm font-medium text-[var(--ink)] truncate">{user.name}</div>
                <div className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] truncate">
                  {ROLE_LABELS[user.role] || user.role}
                  {user.department ? ` · ${user.department}` : ''}
                </div>
              </div>
              <Avatar src={user.avatar} name={user.name} size={34} className="ring-1 ring-[var(--line)]" />
              <button
                onClick={resetSession}
                disabled={resetting}
                title="Reset Session — ambil ulang data terbaru dari Lark"
                className="grid place-items-center w-9 h-9 rounded-full border border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition disabled:opacity-60 shrink-0"
              >
                <RotateCcw size={15} className={resetting ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>

    {/* Overlay loading — muncul SEKETIKA saat Reset Session ditekan (feedback instan). */}
    {resetting && (
      <div className="fixed inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
        <div className="panel px-9 py-8 flex flex-col items-center gap-3 text-center">
          <RotateCcw size={26} className="animate-spin text-[var(--blue)]" />
          <p className="label text-[var(--ink)]">Mereset session</p>
          <p className="mono text-[11px] text-[var(--muted)] tracking-wide normal-case">Mengambil data terbaru dari Lark</p>
        </div>
      </div>
    )}
    </>
  );
}
