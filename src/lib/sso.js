import { fetchLarkProfile, refreshProfileByOpenId } from './lark';
import { upsertUser, hasSubordinates } from './users';
import { createSessionToken, setSessionCookie } from './auth';

/**
 * Finalisasi session dari profil Lark: lengkapi is_supervisor, auto-provision/
 * sinkron ke tabel users, lalu terbitkan session cookie aplikasi.
 */
async function finalizeSession(profile, res) {
  // Supervisor = leader departemen di Lark ATAU ada karyawan yang melapor ke user
  // ini (leader_user_id). Penanda ini menentukan akses menu Approval.
  if (!profile.is_supervisor) {
    profile.is_supervisor = await hasSubordinates(profile.lark_user_id);
  }

  // Cetak identitas ke log server — memudahkan menemukan open_id untuk ADMIN_LARK_IDS
  // dan memverifikasi supervisor (leader) ter-resolve.
  console.log(
    `[Lark login] ${profile.name} | open_id=${profile.lark_user_id} | role=${profile.role} | ` +
      `dept=${(profile.department_names || []).join(', ')} | ` +
      `supervisor=${profile.leader_name || '(kosong)'} (${profile.leader_user_id || '-'})`
  );

  await upsertUser(profile);
  const token = await createSessionToken(profile);
  setSessionCookie(res, token);
  return profile;
}

/** Login SSO dari authorization code Lark. */
export async function loginWithCode(code, res) {
  const profile = await fetchLarkProfile(code);
  return finalizeSession(profile, res);
}

/**
 * Reset/refresh session tanpa OAuth ulang — ambil ulang data organisasi terbaru
 * dari Lark (role, atasan, departemen) memakai open_id session yang masih valid,
 * lalu terbitkan session cookie baru.
 */
export async function refreshSession(openId, res) {
  const profile = await refreshProfileByOpenId(openId);
  return finalizeSession(profile, res);
}
