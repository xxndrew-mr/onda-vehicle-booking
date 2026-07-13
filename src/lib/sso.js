import { fetchLarkProfile } from './lark';
import { upsertUser } from './users';
import { createSessionToken, setSessionCookie } from './auth';

/**
 * Selesaikan login SSO dari authorization code Lark:
 * ambil profil + struktur org → auto-provision/sinkron ke tabel users →
 * terbitkan session cookie aplikasi. Return profil untuk respons/redirect.
 */
export async function loginWithCode(code, res) {
  const profile = await fetchLarkProfile(code);
  await upsertUser(profile);
  const token = await createSessionToken(profile);
  setSessionCookie(res, token);
  return profile;
}
