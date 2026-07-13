import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'vb_session';
const STATE_COOKIE = 'vb_oauth_state';
const SESSION_MAX_AGE = 60 * 60 * 24; // 1 hari — batasi jendela stale role/offboarding
// (otorisasi approval juga re-cek role dari tabel users saat aksi, lihat api/bookings/[id].js)

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET belum di-set (minimal 32 karakter acak) di .env.local — lihat .env.example.'
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Buat JWT session dari profil user yang sudah tersinkron.
 * Payload sengaja kecil: identitas + role; data lengkap ada di tabel users.
 */
export async function createSessionToken(user) {
  const department = Array.isArray(user.department_names)
    ? user.department_names.join(', ')
    : user.department_names || '';

  return new SignJWT({
    sub: user.lark_user_id,
    name: user.name,
    email: user.email || '',
    role: user.role,
    is_supervisor: !!user.is_supervisor,
    department,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
  return payload;
}

// Secure ditentukan dari skema APP_BASE_URL (https), BUKAN NODE_ENV — supaya
// deploy intranet via plain HTTP tidak diam-diam membuang cookie (login loop).
function cookiesShouldBeSecure() {
  return (process.env.APP_BASE_URL || '').startsWith('https://');
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (cookiesShouldBeSecure()) parts.push('Secure');
  return parts.join('; ');
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

export function setSessionCookie(res, token) {
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_MAX_AGE }));
}

export function clearSessionCookie(res) {
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, '', { maxAge: 0 }));
}

export function setStateCookie(res, state) {
  appendSetCookie(res, serializeCookie(STATE_COOKIE, state, { maxAge: 600 }));
}

export function clearStateCookie(res) {
  appendSetCookie(res, serializeCookie(STATE_COOKIE, '', { maxAge: 0 }));
}

export function readStateCookie(req) {
  return req.cookies?.[STATE_COOKIE] || '';
}

/** Ambil session dari cookie request API. Return payload atau null. */
export async function getSessionFromReq(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Bungkus handler API agar wajib login. Session tersedia di req.user.
 * opts.roles: batasi ke role tertentu (mis. ['GA', 'ADMIN']).
 */
export function requireAuth(handler, opts = {}) {
  return async (req, res) => {
    const session = await getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ message: 'Belum login. Silakan buka aplikasi lewat Lark.' });
    }
    if (opts.roles && !opts.roles.includes(session.role)) {
      return res.status(403).json({ message: 'Anda tidak punya akses untuk aksi ini.' });
    }
    req.user = session;
    return handler(req, res);
  };
}

export { SESSION_COOKIE, STATE_COOKIE };
