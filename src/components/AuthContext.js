import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({ user: null, loading: true, avatarOf: () => '' });

// Halaman publik yang tidak boleh memicu auto-login (mencegah loop redirect).
const PUBLIC_PATHS = ['/auth-error'];

/**
 * Muat identitas user (/api/auth/me) + direktori foto profil semua user
 * (/api/users/directory) untuk menampilkan avatar di mana pun nama muncul.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState({}); // open_id → { name, avatar }

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.includes(window.location.pathname);

    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          if (isPublic) return null;
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

    // Direktori avatar (abaikan bila gagal/401).
    fetch('/api/users/directory')
      .then((res) => (res.ok ? res.json() : null))
      .then((map) => {
        if (map) setPeople(map);
      })
      .catch(() => {});
  }, []);

  const avatarOf = (openId) => (openId && people[openId]?.avatar) || '';

  return (
    <AuthContext.Provider value={{ user, loading, avatarOf }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
