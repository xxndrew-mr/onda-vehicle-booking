import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({ user: null, loading: true });

// Halaman publik yang tidak boleh memicu auto-login (mencegah loop redirect).
const PUBLIC_PATHS = ['/auth-error'];

/**
 * Muat identitas user dari session (/api/auth/me). Halaman sudah diproteksi
 * di sisi server (proxy.js) — provider ini untuk menampilkan identitas di UI
 * dan menangani session yang kedaluwarsa di tengah pemakaian.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.includes(window.location.pathname);

    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          // Di halaman publik (mis. /auth-error) jangan auto-login → cegah loop redirect.
          if (isPublic) return null;
          // Session habis → ulangi SSO Lark, kembali ke halaman semula (dengan query).
          const dest = window.location.pathname + window.location.search;
          window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(dest)}`;
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
