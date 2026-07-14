import { LogOut, LogIn } from 'lucide-react';

/** Halaman "sudah keluar" — publik (dikecualikan dari proxy & auto-login). */
export default function Keluar() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 sm:p-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm ring-1 ring-gray-100 p-8 text-center">
        <div className="mx-auto w-14 h-14 grid place-items-center rounded-full bg-blue-50 text-blue-700 mb-4">
          <LogOut size={26} />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Anda telah keluar</h1>
        <p className="text-gray-600 mb-6">
          Session aplikasi sudah diakhiri. Silakan masuk kembali lewat Lark untuk melanjutkan.
        </p>
        <button
          onClick={() => { window.location.href = '/api/auth/login'; }}
          className="inline-flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-md hover:bg-blue-800 transition"
        >
          <LogIn size={16} /> Masuk kembali
        </button>
      </div>
    </div>
  );
}
