// Helper fetch untuk API internal. Menangani 401 (session habis) secara
// terpusat: arahkan ke SSO Lark dan kembali ke halaman semula (query dipertahankan).

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const dest = window.location.pathname + window.location.search;
  window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(dest)}`;
}

async function parseOrThrow(res) {
  if (res.status === 401) {
    redirectToLogin();
    // Hentikan alur pemanggil; navigasi sedang berlangsung.
    throw new Error('Session berakhir. Mengarahkan ke login…');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request gagal (HTTP ${res.status})`;
    throw new Error(message);
  }
  return data;
}

export async function getJson(url) {
  return parseOrThrow(await fetch(url));
}

export async function sendJson(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseOrThrow(res);
}
