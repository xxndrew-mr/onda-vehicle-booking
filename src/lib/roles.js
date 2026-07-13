/**
 * Resolusi role aplikasi dari data organisasi Lark — tidak ada pengelolaan
 * role manual. Dievaluasi ulang setiap login sehingga selalu mengikuti
 * perubahan struktur organisasi di Lark.
 *
 * Prioritas:
 *   1. ADMIN — email ada di env ADMIN_EMAILS (dipisah koma).
 *   2. GA    — anggota departemen General Affairs (nama departemen cocok
 *              dengan env GA_DEPARTMENT_NAMES, default "General Affairs,GA").
 *   3. GM / MANAGER — dari job title dan/atau posisi sebagai leader
 *              departemen di Lark (hanya label tampilan; otorisasi approval
 *              supervisor memakai leader_user_id per-booking, bukan role).
 *   4. STAFF — selain itu.
 */

function csvEnv(name, fallback = '') {
  return (process.env[name] || fallback)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveRole({ emails = [], departmentNames = [], jobTitle = '', isDepartmentLeader = false }) {
  const adminEmails = csvEnv('ADMIN_EMAILS');
  if (emails.some((e) => e && adminEmails.includes(e.toLowerCase()))) return 'ADMIN';

  const gaNames = csvEnv('GA_DEPARTMENT_NAMES', 'General Affairs,GA');
  const inGa = departmentNames.some((d) => gaNames.includes(String(d).trim().toLowerCase()));
  if (inGa) return 'GA';

  const title = (jobTitle || '').toLowerCase();
  if (/\b(general manager|gm|direktur|director)\b/.test(title)) return 'GM';
  if (isDepartmentLeader || /\bmanager\b/.test(title)) return 'MANAGER';

  return 'STAFF';
}
