import Link from 'next/link';
import { useRouter } from 'next/router';
import { Car, CalendarDays, ClipboardCheck, ShieldCheck, LogOut, User } from 'lucide-react';
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

  // Menu Approval hanya untuk yang benar-benar bisa menyetujui:
  // supervisor (leader divisi di Lark / punya bawahan) atau GA/Admin.
  const canApprove =
    !!user && (user.is_supervisor || user.role === 'GA' || user.role === 'ADMIN');

  const links = [
    { href: '/', label: 'Booking', icon: CalendarDays, show: true },
    { href: '/approval', label: 'Approval', icon: ClipboardCheck, show: canApprove },
    { href: '/security', label: 'Security', icon: ShieldCheck, show: true },
  ].filter((l) => l.show);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <nav className="bg-blue-900 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Car size={22} />
          <span>Car Booking &mdash; PT. Onda Mega Integra</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition ${
                  pathname === href ? 'bg-blue-700 font-semibold' : 'hover:bg-blue-800'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </div>

          {user && (
            <div className="flex items-center gap-2 pl-3 border-l border-blue-700">
              <User size={16} />
              <div className="text-sm leading-tight">
                <div className="font-semibold">{user.name}</div>
                <div className="text-xs text-blue-200">
                  {ROLE_LABELS[user.role] || user.role}
                  {user.department ? ` · ${user.department}` : ''}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Reset session"
                className="ml-1 p-1.5 rounded hover:bg-blue-800 transition"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
