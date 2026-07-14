import { fetchLarkProfile } from './lark';
import { upsertUser, hasSubordinates } from './users';
import { createSessionToken, setSessionCookie } from './auth';

/**
 * Selesaikan login SSO dari authorization code Lark:
 * ambil profil + struktur org → auto-provision/sinkron ke tabel users →
 * terbitkan session cookie aplikasi. Return profil untuk respons/redirect.
 */
export async function loginWithCode(code, res) {
  const profile = await fetchLarkProfile(code);

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
