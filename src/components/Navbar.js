import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CalendarDays, ClipboardCheck, Truck, History, RotateCcw, Sun, Moon, Menu, X } from 'lucide-react';
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
  const router = useRouter();
  const { pathname } = router;
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [resetting, setResetting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Tutup drawer mobile tiap selesai pindah halaman (via event router).
  useEffect(() => {
    const close = () => setMenuOpen(false);
    router.events.on('routeChangeComplete', close);
    return () => router.events.off('routeChangeComplete', close);
  }, [router.events]);

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
      <nav className="max-w-6xl mx-auto nav-surface backdrop-blur-md ring-1 ring-white/10 rounded-[var(--radius)] shadow-[0_18px_44px_-24px_rgba(14,34,150,0.65)] overflow-hidden">
        <div className="px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          {/* Brand — logo di chip putih agar kontras di atas navbar biru */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setMenuOpen(false)}>
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-white p-1 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-login.png" alt="Logo PT Onda Mega Integra" className="w-full h-full object-contain" />
            </span>
            <span className="hidden lg:block font-display text-[17px] text-white leading-none">PT Onda Mega Integra</span>
          </Link>

          {/* Menu inline — desktop saja */}
          <div className="hidden md:flex items-center gap-1">
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
                <span>{label}</span>
              </Link>
            ))}
          </div>

          {/* Kanan: toggle tema (selalu) + user (desktop) + hamburger (mobile) */}
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
              <div className="hidden md:flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-white/20">
                <div className="text-right leading-tight max-w-[10rem]">
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

            {/* Hamburger — mobile saja (ikon Menu↔X animasi putar+fade) */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="md:hidden grid place-items-center w-9 h-9 rounded-full border border-white/30 text-white/90 hover:bg-white/15 hover:text-white transition"
            >
              <span className="relative block w-[18px] h-[18px]">
                <Menu
                  size={18}
                  className={`absolute inset-0 transition-all duration-300 motion-reduce:transition-none ${
                    menuOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0'
                  }`}
                />
                <X
                  size={18}
                  className={`absolute inset-0 transition-all duration-300 motion-reduce:transition-none ${
                    menuOpen ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90 scale-75'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Drawer mobile — selalu ter-mount, animasi buka/tutup via grid-rows
            (0fr→1fr, tinggi otomatis mulus). Item muncul bertahap (stagger).
            inert saat tertutup: tidak bisa di-tab/di-klik. */}
        <div
          inert={!menuOpen || undefined}
          className={`md:hidden grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none ${
            menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className="border-t border-white/15 px-2 py-2">
              {user && (
                <div
                  style={{ transitionDelay: menuOpen ? '60ms' : '0ms' }}
                  className={`flex items-center gap-3 px-2 py-2.5 transition-all duration-300 motion-reduce:transition-none ${
                    menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                  }`}
                >
                  <Avatar src={user.avatar} name={user.name} size={38} className="ring-2 ring-white/30" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{user.name}</div>
                    <div className="text-[11px] text-white/70 truncate">
                      {ROLE_LABELS[user.role] || user.role}
                      {user.department ? ` · ${user.department}` : ''}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-1 space-y-0.5">
                {links.map(({ href, label, icon: Icon }, i) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    style={{ transitionDelay: menuOpen ? `${90 + i * 45}ms` : '0ms' }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-300 motion-reduce:transition-none ${
                      menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                    } ${
                      pathname === href ? 'bg-white text-[var(--brand-deep)]' : 'text-white/90 hover:bg-white/15'
                    }`}
                  >
                    <Icon size={18} /> {label}
                  </Link>
                ))}
              </div>

              {user && (
                <button
                  onClick={resetSession}
                  disabled={resetting}
                  style={{ transitionDelay: menuOpen ? `${90 + links.length * 45}ms` : '0ms' }}
                  className={`mt-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] font-medium text-white/90 hover:bg-white/15 transition-all duration-300 motion-reduce:transition-none disabled:opacity-60 ${
                    menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                  }`}
                >
                  <RotateCcw size={18} className={resetting ? 'animate-spin' : ''} /> Reset Session
                </button>
              )}
            </div>
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
