import { resolveRole } from './roles';

/**
 * Klien Lark Open Platform (endpoint diverifikasi dari dokumentasi resmi):
 * - Authorize : GET  {accounts}/open-apis/authen/v1/authorize?client_id=...
 *               (di dalam klien Lark: auto-consent, redirect langsung tanpa UI)
 * - Token v2  : POST {open}/open-apis/authen/v2/oauth/token
 *               (respons top-level ala RFC6749, field "code" bertipe STRING "0")
 * - User info : GET  {open}/open-apis/authen/v1/user_info (Bearer user_access_token)
 * - Contact   : GET  {open}/open-apis/contact/v3/... (Bearer tenant_access_token,
 *               envelope klasik { code: 0, msg, data })
 */

function openBase() {
  return (process.env.LARK_OPEN_BASE_URL || 'https://open.larksuite.com').replace(/\/$/, '');
}

function accountsBase() {
  // open.larksuite.com -> accounts.larksuite.com | open.feishu.cn -> accounts.feishu.cn
  return openBase().replace('//open.', '//accounts.');
}

function applinkBase() {
  // open.larksuite.com -> applink.larksuite.com | open.feishu.cn -> applink.feishu.cn
  return openBase().replace('//open.', '//applink.');
}

/**
 * Bungkus URL aplikasi jadi Lark applink agar dibuka DI DALAM klien Lark (webview),
 * bukan browser eksternal. Penting untuk link di notifikasi bot: di dalam klien,
 * sesi Lark tersedia sehingga SSO berjalan otomatis tanpa halaman login. Di browser
 * luar (tanpa sesi Lark) user akan dihadapkan halaman login Lark dulu.
 */
export function larkAppLink(url) {
  if (!url) return '';
  return `${applinkBase()}/client/web_url/open?url=${encodeURIComponent(url)}`;
}

function getAppCredentials() {
  const { LARK_APP_ID, LARK_APP_SECRET } = process.env;
  if (!LARK_APP_ID || !LARK_APP_SECRET) {
    throw new Error(
      'Konfigurasi Lark belum lengkap. Set LARK_APP_ID dan LARK_APP_SECRET di .env.local ' +
        '(dari Lark Developer Console → Credentials & Basic Info).'
    );
  }
  return { appId: LARK_APP_ID, appSecret: LARK_APP_SECRET };
}

export function getRedirectUri() {
  const base = process.env.APP_BASE_URL;
  if (!base) {
    throw new Error('APP_BASE_URL belum di-set di .env.local (URL publik aplikasi ini).');
  }
  return `${base.replace(/\/$/, '')}/api/auth/callback`;
}

/** URL halaman otorisasi Lark. Di dalam klien Lark, langsung redirect balik tanpa konfirmasi. */
export function buildAuthorizeUrl(state) {
  const { appId } = getAppCredentials();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: getRedirectUri(),
    state,
  });
  return `${accountsBase()}/open-apis/authen/v1/authorize?${params.toString()}`;
}

/** GET API Lark ber-envelope klasik { code: 0, msg, data }. */
async function larkGet(path, token) {
  const res = await fetch(`${openBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!body || body.code !== 0) {
    throw new Error(`Lark API ${path.split('?')[0]} gagal: [${body?.code}] ${body?.msg || 'respons tidak valid'}`);
  }
  return body.data;
}

// ---------- tenant_access_token (identitas aplikasi, di-cache) ----------

let tenantTokenCache = { token: null, expiresAt: 0 };

export async function getTenantAccessToken() {
  if (tenantTokenCache.token && Date.now() < tenantTokenCache.expiresAt) {
    return tenantTokenCache.token;
  }

  const { appId, appSecret } = getAppCredentials();
  const res = await fetch(`${openBase()}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const body = await res.json().catch(() => null);
  if (!body || body.code !== 0) {
    throw new Error(`Gagal mengambil tenant_access_token Lark: [${body?.code}] ${body?.msg || ''}`);
  }

  tenantTokenCache = {
    token: body.tenant_access_token,
    // refresh 5 menit sebelum kedaluwarsa (expire dalam detik, maks 2 jam)
    expiresAt: Date.now() + (body.expire - 300) * 1000,
  };
  return tenantTokenCache.token;
}

// ---------- Notifikasi pesan bot (IM) ----------

/**
 * Kirim pesan teks dari bot aplikasi ke seorang user (by open_id) memakai
 * tenant_access_token. Prasyarat di Developer Console: kapabilitas "Bot" aktif,
 * scope `im:message:send_as_bot`, dan visible range app mencakup penerima.
 */
export async function sendLarkMessage(openId, text) {
  return sendLarkIm(openId, 'text', { text });
}

/**
 * Kirim KARTU interaktif (msg_type "interactive") — dipakai notifikasi supaya
 * link tampil sebagai TOMBOL, bukan URL panjang. Prasyarat sama dengan pesan teks.
 */
export async function sendLarkCard(openId, card) {
  return sendLarkIm(openId, 'interactive', card);
}

async function sendLarkIm(openId, msgType, contentObj) {
  if (!openId || !contentObj) return null;
  const tenantToken = await getTenantAccessToken();
  const res = await fetch(`${openBase()}/open-apis/im/v1/messages?receive_id_type=open_id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tenantToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: msgType,
      content: JSON.stringify(contentObj), // content WAJIB string JSON ter-escape
    }),
  });
  const body = await res.json().catch(() => null);
  if (!body || body.code !== 0) {
    throw new Error(`Lark IM gagal: [${body?.code}] ${body?.msg || 'respons tidak valid'}`);
  }
  return body.data;
}

// ---------- OAuth: tukar authorization code → user_access_token ----------

export async function exchangeCodeForUserToken(code) {
  const { appId, appSecret } = getAppCredentials();
  const res = await fetch(`${openBase()}/open-apis/authen/v2/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  // Endpoint v2 memakai respons top-level (bukan envelope data), code = STRING.
  const body = await res.json().catch(() => null);
  if (!body || String(body.code) !== '0' || !body.access_token) {
    throw new Error(
      `Gagal menukar authorization code Lark: ${body?.error_description || body?.error || `code ${body?.code}`}`
    );
  }
  return body.access_token;
}

// ---------- Profil user + struktur organisasi ----------

async function getContactUser(openId, tenantToken) {
  const data = await larkGet(
    `/open-apis/contact/v3/users/${openId}?user_id_type=open_id&department_id_type=open_department_id`,
    tenantToken
  );
  return data.user;
}

async function getDepartment(departmentId, tenantToken) {
  const data = await larkGet(
    `/open-apis/contact/v3/departments/${departmentId}?department_id_type=open_department_id&user_id_type=open_id`,
    tenantToken
  );
  return data.department;
}

function departmentDisplayName(dept) {
  return dept.i18n_name?.en_us || dept.name || '';
}

// Leader (open_id) sebuah departemen: utamakan leader_user_id, lalu leader
// primary (leaderType 1), lalu leader pertama. '' bila tidak ada.
function deptLeaderId(dept) {
  const primary = (dept.leaders || []).find((l) => l.leaderType === 1) || (dept.leaders || [])[0];
  return dept.leader_user_id || primary?.leaderID || '';
}

/**
 * Cari supervisor dengan menelusuri hierarki departemen KE ATAS.
 * Mulai dari departemen (daun) user: bila leader-nya kosong ATAU = user itu
 * sendiri, naik ke induk (`parent_department_id`) sampai ketemu leader valid
 * (≠ user) atau mencapai puncak organisasi. Mengembalikan open_id leader / ''.
 * Contoh: user sendirian di sub-divisi "ERP & Business Systems" → naik ke
 * departemen induk "IT" dan pakai kepala IT sebagai supervisor.
 */
async function findSupervisorUpChain(startDept, openId, tenantToken) {
  let dept = startDept;
  const seen = new Set();
  // Batas kedalaman sebagai pengaman (hindari loop bila data hierarki aneh).
  for (let i = 0; i < 10 && dept; i++) {
    const leader = deptLeaderId(dept);
    if (leader && leader !== openId) return leader;
    const parentId = dept.parent_department_id || '';
    // Puncak Lark: parent kosong atau '0' (root). Berhenti bila sudah dikunjungi.
    if (!parentId || parentId === '0' || seen.has(parentId)) return '';
    seen.add(parentId);
    try {
      dept = await getDepartment(parentId, tenantToken);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Bangun profil ternormalisasi dari open_id memakai Contact API (tenant token):
 * departemen, supervisor, job title, role. `info` (opsional) = data user_info saat
 * login; saat refresh (tanpa OAuth) info null → identitas diambil dari Contact API.
 */
async function buildProfileFromOpenId(openId, tenantToken, info = null) {
  let contact;
  try {
    contact = await getContactUser(openId, tenantToken);
  } catch (e) {
    throw new Error(
      `${e.message} — pastikan permission "contact:contact:readonly_as_app" sudah di-grant ` +
        'dan Data Permission (contacts range) aplikasi mencakup user ini di Lark Developer Console.'
    );
  }

  // Departemen: nama (mapping role GA) + apakah user leader-nya. Error TIDAK di-swallow.
  const departmentIds = contact.department_ids || [];
  let departments;
  try {
    departments = await Promise.all(departmentIds.map((id) => getDepartment(id, tenantToken)));
  } catch (e) {
    throw new Error(`Gagal membaca data departemen dari Lark: ${e.message}`);
  }
  const departmentNames = departments.map(departmentDisplayName).filter(Boolean);
  const isDepartmentLeader = departments.some(
    (d) =>
      d.leader_user_id === openId ||
      (d.leaders || []).some((l) => l.leaderID === openId)
  );

  // Supervisor: atasan langsung (leader_user_id) DULU; bila kosong, jatuh ke
  // leader departemen — DENGAN menelusuri hierarki ke atas. Jadi user yang
  // sendirian di sub-divisi (tanpa leader di situ) tetap naik ke leader
  // departemen induk (mis. sub-divisi "ERP & Business Systems" → kepala "IT").
  let supervisorId = contact.leader_user_id || '';
  if (!supervisorId) {
    for (const d of departments) {
      const found = await findSupervisorUpChain(d, openId, tenantToken);
      if (found) {
        supervisorId = found;
        break;
      }
    }
  }

  let leaderName = '';
  if (supervisorId) {
    try {
      const leader = await getContactUser(supervisorId, tenantToken);
      leaderName = leader.name || '';
    } catch {
      leaderName = '';
    }
  }

  const email = contact.enterprise_email || contact.email || info?.email || '';
  const role = resolveRole({
    larkUserId: openId,
    emails: [contact.enterprise_email, contact.email, info?.email].filter(Boolean),
    departmentNames,
    jobTitle: contact.job_title || '',
    isDepartmentLeader,
  });

  return {
    lark_user_id: openId,
    union_id: info?.union_id || contact.union_id || '',
    name: contact.name || info?.name || '',
    email,
    employee_no: contact.employee_no || '',
    job_title: contact.job_title || '',
    department_ids: departmentIds,
    department_names: departmentNames,
    leader_user_id: supervisorId,
    leader_name: leaderName,
    role,
    is_supervisor: isDepartmentLeader,
    // Konsisten pakai 240px dari Contact API (selalu tersedia) supaya crisp di UI.
    avatar_url:
      contact.avatar?.avatar_240 ||
      contact.avatar?.avatar_72 ||
      info?.avatar_middle ||
      info?.avatar_url ||
      '',
  };
}

/**
 * Alur lengkap SSO: code → user_access_token → identitas dasar →
 * data organisasi via Contact API → profil ternormalisasi.
 */
export async function fetchLarkProfile(code) {
  const userToken = await exchangeCodeForUserToken(code);
  const info = await larkGet('/open-apis/authen/v1/user_info', userToken);
  const tenantToken = await getTenantAccessToken();
  return buildProfileFromOpenId(info.open_id, tenantToken, info);
}

/**
 * Refresh profil TANPA OAuth ulang: cukup pakai open_id (dari session yang masih
 * valid) + tenant token. Dipakai tombol "Reset Session" untuk mengambil ulang
 * role/atasan/departemen terbaru dari Lark tanpa redirect login.
 */
export async function refreshProfileByOpenId(openId) {
  const tenantToken = await getTenantAccessToken();
  return buildProfileFromOpenId(openId, tenantToken, null);
}
