import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CalendarDays, ClipboardCheck, Truck, History, RotateCcw, Sun, Moon } from 'lucide-react';
// ShieldCheck (menu Security) dinonaktifkan sementara — lihat link di bawah.
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
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
  const { theme, toggle } = useTheme();
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
    window.location.reload();
  };

  return (
    <>
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className="max-w-6xl mx-auto nav-surface backdrop-blur-md ring-1 ring-white/10 rounded-[var(--radius)] shadow-[0_18px_44px_-24px_rgba(14,34,150,0.65)]">
        <div className="px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          {/* Brand — logo di chip putih agar kontras di atas navbar biru */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-white p-1 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-login.png" alt="Logo PT Onda Mega Integra" className="w-full h-full object-contain" />
            </span>
            <span className="hidden lg:block font-display text-[17px] text-white leading-none">PT Onda Mega Integra</span>
          </Link>

          {/* Menu — label lebih besar & jelas (dibaca lintas usia) */}
          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors ${
                  pathname === href
                    ? 'bg-white text-[var(--brand-deep)] shadow-sm'
                    : 'text-white/85 hover:bg-white/15 hover:text-white'
                }`}
              >
                <Icon size={17} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
          </div>

          {/* Kanan: toggle tema (selalu tampil) + user/reset */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => toggle(e)}
              aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
              className="grid place-items-center w-9 h-9 rounded-full border border-white/30 text-white/90 hover:bg-white/15 hover:text-white transition"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {user && (
              <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-white/20">
                <div className="text-right leading-tight hidden md:block max-w-[10rem]">
                  <div className="text-sm font-semibold text-white truncate">{user.name}</div>
                  <div className="text-[11px] text-white/70 truncate">
                    {ROLE_LABELS[user.role] || user.role}
                    {user.department ? ` · ${user.department}` : ''}
                  </div>
                </div>
                <Avatar src={user.avatar} name={user.name} size={34} className="ring-2 ring-white/30" />
                <button
                  onClick={resetSession}
                  disabled={resetting}
                  title="Reset Session — ambil ulang data terbaru dari Lark"
                  className="grid place-items-center w-9 h-9 rounded-full border border-white/30 text-white/90 hover:bg-white/15 hover:text-white transition disabled:opacity-60 shrink-0"
                >
                  <RotateCcw size={16} className={resetting ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>

    {/* Overlay loading — muncul SEKETIKA saat Reset Session ditekan (feedback instan). */}
    {resetting && (
      <div className="fixed inset-0 bg-[var(--ink)]/40 flex items-center justify-center p-4 z-[60]">
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
