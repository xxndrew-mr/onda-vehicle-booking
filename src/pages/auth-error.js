import { useRouter } from 'next/router';
import Button from '../components/Button';

/** Halaman publik untuk menampilkan kegagalan SSO (dikecualikan dari proxy auth). */
export default function AuthError() {
  const { query } = useRouter();
  const message = typeof query.message === 'string' ? query.message : 'Terjadi kesalahan saat login.';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-8">
      <div className="max-w-xl w-full">
        <div className="mb-6">
          <span className="inline-flex items-center gap-[0.6rem] mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--danger)]">
            <span className="w-[26px] h-px" style={{ background: 'var(--danger)' }} /> Login Gagal
          </span>
        </div>
        <h1 className="page-title text-[var(--ink)]">Login Lark Gagal</h1>

        <div className="mt-6 panel p-5 border-[var(--danger-line)] bg-[var(--danger-wash)]">
          <p className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--danger)] mb-2">Pesan sistem</p>
          <p className="text-sm text-[var(--ink)] break-words leading-relaxed">{message}</p>
        </div>

        <div className="mt-6">
          <Button variant="primary" arrow onClick={() => { window.location.href = '/api/auth/login'; }}>
            Coba Login Lagi
          </Button>
        </div>

        <p className="text-xs text-[var(--muted)] mt-8 leading-relaxed max-w-md">
          Jika masalah berlanjut, hubungi admin: pastikan aplikasi dibuka lewat Lark Workplace dan
          konfigurasi Lark Developer Console sudah benar.
        </p>
      </div>
    </div>
  );
}
