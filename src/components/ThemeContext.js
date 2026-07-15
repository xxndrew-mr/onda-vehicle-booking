import { createContext, useContext, useCallback, useSyncExternalStore } from 'react';

const ThemeContext = createContext({ theme: 'light', toggle: () => {} });

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Store eksternal: sumber kebenaran tema = atribut <html data-theme> ---
// (di-set skrip anti-flash sebelum React jalan). React membacanya lewat
// useSyncExternalStore — tanpa setState-in-effect, tanpa mismatch hidrasi.
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const currentTheme = () =>
  (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark')
    ? 'dark'
    : 'light';
const serverTheme = () => 'light';

/**
 * Terapkan tema ke <html data-theme>. "Super smooth":
 *  - Browser dengan View Transitions API → efek lingkaran menyebar dari titik klik.
 *  - Selain itu → crossfade warna singkat (kelas .theme-transition, dilepas 0.5s).
 *  - prefers-reduced-motion → ganti seketika tanpa animasi.
 * Preferensi disimpan di localStorage (dibaca skrip anti-flash di _document).
 */
function applyTheme(next, origin) {
  const root = document.documentElement;
  try { localStorage.setItem('theme', next); } catch { /* mode privat: abaikan */ }

  const reduce = prefersReduced();

  if (reduce || typeof document.startViewTransition !== 'function') {
    if (!reduce) {
      root.classList.add('theme-transition');
      window.setTimeout(() => root.classList.remove('theme-transition'), 520);
    }
    root.dataset.theme = next;
    emit();
    return;
  }

  // Titik asal lingkaran = posisi tombol yang diklik (fallback ke pojok kanan-atas).
  const x = origin?.clientX ?? window.innerWidth - 40;
  const y = origin?.clientY ?? 40;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const vt = document.startViewTransition(() => {
    root.dataset.theme = next;
    emit();
  });
  vt.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 520,
          easing: 'cubic-bezier(.16, 1, .3, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    })
    .catch(() => { /* transisi dibatalkan: tema tetap sudah berganti */ });
}

export function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);

  const toggle = useCallback((origin) => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next, origin);
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
