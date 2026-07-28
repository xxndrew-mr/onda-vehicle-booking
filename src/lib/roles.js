/**
 * Resolusi role aplikasi dari data organisasi Lark — tidak ada pengelolaan
 * role manual. Dievaluasi ulang setiap login sehingga selalu mengikuti
 * perubahan struktur organisasi di Lark.
 *
 * Prioritas:
 *   1. ADMIN — open_id ada di env ADMIN_LARK_IDS, ATAU email ada di ADMIN_EMAILS
 *              (keduanya dipisah koma). ADMIN_LARK_IDS paling andal karena open_id
 *              selalu tersedia tanpa perlu scope email.
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

/**
 * PA (Personal Assistant) MELEWATI tahap supervisor — booking-nya langsung
 * `Pending GA` (atasan PA tidak perlu meng-approve). Identifikasi via:
 *   - env PA_DEPARTMENT_NAMES : kecocokan PERSIS nama departemen Lark
 *     (default "Personal Assistant Commissioner,Sekretaris & PA"), atau
 *   - env PA_LARK_IDS   : daftar open_id dipisah koma, atau
 *   - env PA_JOB_TITLES : kecocokan PERSIS job title (default "PA,Personal Assistant").
 * Semua case-insensitive. Dievaluasi saat booking DIBUAT (profil dari tabel users).
 */
export function skipsSupervisorStage({ larkUserId = '', jobTitle = '', departmentNames = [] }) {
  const paDepts = csvEnv('PA_DEPARTMENT_NAMES', 'Personal Assistant Commissioner,Sekretaris & PA');
  if (departmentNames.some((d) => paDepts.includes(String(d).trim().toLowerCase()))) return true;

  const paIds = csvEnv('PA_LARK_IDS');
  if (larkUserId && paIds.includes(String(larkUserId).toLowerCase())) return true;

  const paTitles = csvEnv('PA_JOB_TITLES', 'PA,Personal Assistant');
  const title = String(jobTitle || '').trim().toLowerCase();
  return !!title && paTitles.includes(title);
}

export function resolveRole({
  larkUserId = '',
  emails = [],
  departmentNames = [],
  jobTitle = '',
  isDepartmentLeader = false,
}) {
  const adminIds = csvEnv('ADMIN_LARK_IDS');
  if (larkUserId && adminIds.includes(larkUserId.toLowerCase())) return 'ADMIN';

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
