import { useRouter } from 'next/router';
import { ShieldAlert, RotateCcw } from 'lucide-react';

/** Halaman publik untuk menampilkan kegagalan SSO (dikecualikan dari proxy auth). */
export default function AuthError() {
  const { query } = useRouter();
  const message = typeof query.message === 'string' ? query.message : 'Terjadi kesalahan saat login.';

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Login Lark Gagal</h1>
        <p className="text-gray-600 mb-6 break-words">{message}</p>
        <button
          onClick={() => { window.location.href = '/api/auth/login'; }}
          className="inline-flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-md hover:bg-blue-800 transition"
        >
          <RotateCcw size={16} /> Coba Login Lagi
        </button>
        <p className="text-xs text-gray-400 mt-6">
          Jika masalah berlanjut, hubungi admin: pastikan aplikasi dibuka lewat Lark Workplace dan
          konfigurasi Lark Developer Console sudah benar.
        </p>
      </div>
    </div>
  );
}
