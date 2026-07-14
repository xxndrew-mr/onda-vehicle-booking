# Car Booking System — PT. Onda Mega Integra

Sistem booking mobil kantor internal berbasis web, terintegrasi penuh dengan **Lark**. Karyawan membuka aplikasi dari **Lark Workplace → App List** dan langsung masuk lewat **Lark SSO** (tanpa halaman login). Permohonan disetujui berjenjang mengikuti **struktur organisasi di Lark** (supervisor otomatis dari `leader_user_id`), lalu difinalisasi General Affairs, dan booking yang disetujui tampil di dashboard Security.

## Fitur

| Halaman | Route | Fungsi |
|---|---|---|
| Booking | `/` | Kalender mingguan (FullCalendar). Pilih kendaraan + slot waktu → isi keperluan → terkirim atas nama akun Lark Anda. Jadwal bentrok otomatis ditolak. |
| Riwayat | `/riwayat` | Tab **Booking Saya** (semua pengajuan sendiri + batalkan) dan tab **Riwayat Persetujuan** (khusus supervisor/GA/ADMIN: daftar booking yang pernah diproses, dengan aksi tercatat per tahap). |
| Approval | `/approval` | Dua antrian nyata: **(1)** pengajuan anggota tim yang supervisornya = Anda (otomatis dari struktur Lark), **(2)** antrian GA (hanya tampil untuk role GA/ADMIN). Di tahap GA, bila kendaraan bermasalah GA dapat mengganti armada dengan alasan wajib. |
| Armada | `/armada` | **Khusus GA/ADMIN.** Tambah/ubah kendaraan & ubah status (Ready/In Use/Maintenance/Unavailable). Status langsung memengaruhi ketersediaan booking. |
| ~~Security~~ | ~~`/security`~~ | Dinonaktifkan sementara (source di-comment, mudah diaktifkan kembali). |
| Security | `/security` | Monitor gerbang: kendaraan ber-status **Approved** dengan plat nomor, pengguna, dan jam keluar. |

## Arsitektur Integrasi Lark

```
┌────────────┐   1. buka app     ┌──────────────────────────────────────────┐
│ Lark Client │ ────────────────► │ Next.js (proxy.js cek session cookie)    │
│ (Workplace) │                   └───────────────┬──────────────────────────┘
└────────────┘                          tidak ada session
                                                  ▼
                2. redirect ke accounts.larksuite.com/open-apis/authen/v1/authorize
                          (di dalam klien Lark: AUTO-CONSENT, tanpa UI apa pun)
                                                  ▼
                       3. Lark redirect balik → /api/auth/callback?code=...&state=...
                                                  ▼
       4. Server: verifikasi state (anti-CSRF)
          → POST /open-apis/authen/v2/oauth/token   (code → user_access_token)
          → GET  /open-apis/authen/v1/user_info     (identitas dasar: open_id, nama)
          → GET  /open-apis/contact/v3/users/{open_id}   (tenant token: departemen,
                                                    leader_user_id = SUPERVISOR,
                                                    job_title, employee_no, email)
          → GET  /open-apis/contact/v3/departments/{id}  (nama dept → mapping role GA,
                                                    cek user = leader dept?)
          → MERGE ke BigQuery users                (auto-provision / sinkronisasi)
          → terbitkan JWT session (httpOnly cookie, 1 hari)
                                                  ▼
                       5. redirect ke halaman tujuan → user sudah login ✅
```

Keputusan desain penting:

- **Session milik aplikasi (JWT httpOnly cookie)**, bukan token Lark per-request. Token Lark hanya dipakai sesaat ketika login untuk mengambil profil; tidak ada token Lark yang disimpan — paling aman dan hemat rate limit.
- **Data organisasi via `tenant_access_token`** (identitas aplikasi, di-cache ±2 jam), bukan scope user — sehingga authorize URL tanpa scope = konsen otomatis & mulus di dalam Lark.
- **Role & supervisor tidak pernah dikelola manual.** Dievaluasi ulang dari Lark pada setiap login (lihat tabel di bawah). Perubahan struktur organisasi otomatis terrefleksi saat user login berikutnya.
- **`proxy.js`** (pengganti `middleware.js` di Next 16) memproteksi seluruh halaman & API: tanpa session → halaman di-redirect ke SSO, API menjawab 401 JSON.

### Mapping Role (otomatis dari Lark)

| Role | Sumber kebenaran di Lark | Dipakai untuk |
|---|---|---|
| ADMIN | open_id ada di env `ADMIN_LARK_IDS` (paling andal), atau email di `ADMIN_EMAILS` | Melihat & memproses **semua** tahap: supervisor divisi mana pun **dan** GA |
| GA | Anggota departemen yang namanya cocok `GA_DEPARTMENT_NAMES` | Tahap approval final + konfirmasi kendaraan |
| GM | `job_title` mengandung GM/General Manager/Direktur | Label tampilan |
| MANAGER | Leader departemen di Lark, atau `job_title` Manager | Label tampilan |
| STAFF | Selain di atas | — |

> Otorisasi tahap **supervisor tidak memakai role**, melainkan pencocokan langsung: booking menyimpan `supervisor_id` = `leader_user_id` pemohon dari Lark, dan hanya user itu (atau ADMIN) yang bisa approve/reject tahap tersebut.

### Alur Persetujuan

```
Karyawan mengajukan booking
        │
        ├── punya supervisor di Lark (leader_user_id) ──► Pending Supervisor
        │                                                     │ (approve oleh
        │                                                     ▼  supervisor ybs)
        └── tidak punya (mis. GM/Direktur puncak) ──────► Pending GA
                                                              │ (approve oleh GA)
                                                              ▼
                                                          Approved ──► dashboard Security
        (REJECT di tahap mana pun → Rejected By Supervisor / Rejected By GA)
```

## Teknologi

Next.js 16 (Pages Router) + React 19 · Tailwind CSS v4 · FullCalendar 6 · Google BigQuery · `jose` (JWT session) · Lark Open Platform (OAuth v2, Contact API v3)

## Setup

### 1. Install dependensi

```bash
npm install
```

### 2. Siapkan BigQuery

Jalankan di BigQuery console:

```sql
CREATE SCHEMA IF NOT EXISTS onda_booking_db;

CREATE TABLE IF NOT EXISTS onda_booking_db.vehicles (
  id            STRING NOT NULL,
  name          STRING NOT NULL,
  license_plate STRING,
  status        STRING           -- Ready | In Use | Maintenance | Unavailable (hanya 'Ready' yang bisa dipesan)
);

CREATE TABLE IF NOT EXISTS onda_booking_db.bookings (
  id                   STRING NOT NULL,
  vehicle_id           STRING NOT NULL,
  requester_id         STRING,      -- open_id Lark pemohon
  user_name            STRING,      -- nama pemohon (display)
  user_level           STRING,      -- role pemohon saat mengajukan
  requester_department STRING,      -- divisi/departemen pemohon (dari Lark)
  supervisor_id        STRING,      -- open_id supervisor (leader_user_id dari Lark)
  supervisor_name      STRING,
  start_time           TIMESTAMP,
  end_time             TIMESTAMP,
  purpose              STRING,
  status               STRING,      -- lihat "Alur Persetujuan"
  supervisor_action_by STRING,      -- audit trail approval
  supervisor_action_at TIMESTAMP,
  ga_action_by         STRING,
  ga_action_at         TIMESTAMP,
  original_vehicle_id   STRING,      -- kendaraan asli bila GA mengganti armada
  vehicle_change_reason STRING,      -- alasan pergantian (wajib saat GA ganti)
  vehicle_change_by     STRING,
  vehicle_change_at     TIMESTAMP,
  created_at           TIMESTAMP
);

-- Auto-provisioning user dari Lark SSO (disinkron setiap login)
CREATE TABLE IF NOT EXISTS onda_booking_db.users (
  lark_user_id     STRING NOT NULL,  -- open_id
  union_id         STRING,
  name             STRING,
  email            STRING,
  employee_no      STRING,
  job_title        STRING,
  department_ids   STRING,           -- JSON array open_department_id
  department_names STRING,
  leader_user_id   STRING,           -- supervisor langsung dari struktur Lark
  leader_name      STRING,
  role             STRING,           -- ADMIN | GA | GM | MANAGER | STAFF
  is_supervisor    BOOL,
  avatar_url       STRING,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP,
  last_login_at    TIMESTAMP
);

-- Contoh data kendaraan
INSERT INTO onda_booking_db.vehicles (id, name, license_plate) VALUES
  ('v1', 'Toyota Avanza', 'B 1234 OMI'),
  ('v2', 'Toyota Innova', 'B 5678 OMI');
```

**Migrasi dari versi lama** (tabel `bookings` sudah ada):

```sql
ALTER TABLE onda_booking_db.bookings
  ADD COLUMN IF NOT EXISTS requester_id STRING,
  ADD COLUMN IF NOT EXISTS requester_department STRING,
  ADD COLUMN IF NOT EXISTS supervisor_id STRING,
  ADD COLUMN IF NOT EXISTS supervisor_name STRING,
  ADD COLUMN IF NOT EXISTS supervisor_action_by STRING,
  ADD COLUMN IF NOT EXISTS supervisor_action_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ga_action_by STRING,
  ADD COLUMN IF NOT EXISTS ga_action_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS original_vehicle_id STRING,
  ADD COLUMN IF NOT EXISTS vehicle_change_reason STRING,
  ADD COLUMN IF NOT EXISTS vehicle_change_by STRING,
  ADD COLUMN IF NOT EXISTS vehicle_change_at TIMESTAMP;

-- Manajemen armada:
ALTER TABLE onda_booking_db.vehicles ADD COLUMN IF NOT EXISTS status STRING;
UPDATE onda_booking_db.vehicles SET status = 'Ready' WHERE status IS NULL OR status = '';

-- Petakan status lama ke skema baru (kalau tidak, booking lama tersangkut di
-- luar semua antrian approval namun tetap memblokir slot):
UPDATE onda_booking_db.bookings SET status = 'Pending GA'
  WHERE status = 'Pending M/GM';   -- atau 'Pending Supervisor' bila supervisor_id diisi
UPDATE onda_booking_db.bookings SET status = 'Rejected By Supervisor'
  WHERE status = 'Rejected By M/GM';
```

### 3. Siapkan Aplikasi di Lark Developer Console

Semua langkah di https://open.larksuite.com/app :

1. **Create Custom App** (aplikasi internal perusahaan) → isi nama "Vehicle Booking", deskripsi, ikon.
2. **Add Features → Web App** → set **Desktop & Mobile homepage URL** = URL publik aplikasi ini (mis. `https://booking-mobil.onda.works`). Saat development boleh URL ngrok/intranet; produksi wajib URL publik.
3. **Security Settings → Redirect URLs** → daftarkan **persis** `https://booking-mobil.onda.works/api/auth/callback` (`redirect_uri` dicocokkan **exact** dengan nilai terdaftar, tanpa wildcard — pastikan `APP_BASE_URL` sama persis dengan host yang didaftarkan).
4. **Permissions & Scopes** → grant scope berikut (lalu apply):
   - `contact:contact:readonly_as_app` — baca user & departemen sebagai aplikasi (mencakup `leader_user_id`, `department_ids`, `job_title`, `employee_no`, `enterprise_email`)
   - `contact:user.email:readonly` — email pribadi user (opsional; untuk mapping `ADMIN_EMAILS` bila tidak memakai email perusahaan)
5. **Data Permission / Contacts range** → pastikan cakupan data kontak aplikasi mencakup seluruh karyawan yang akan memakai aplikasi (kalau tidak, login gagal dengan error 41050).
6. **Version Management & Release → Create Version** → set **Availability Scope** (karyawan/departemen yang melihat app di Workplace) → **Apply for Release** → tunggu approval admin tenant. (Saat development, gunakan fitur *Test enterprise and personnel* agar tidak perlu approval.)
7. Salin **App ID** dan **App Secret** dari *Credentials & Basic Info* ke `.env.local`.

Di organisasi Lark, pastikan **setiap karyawan punya atasan langsung** (field *Direct manager/Leader* di profil kontak) — field inilah (`leader_user_id`) yang menjadi supervisor approval. Manager/GM yang jadi leader departemen otomatis terdeteksi.

### 4. Konfigurasi environment

```bash
cp .env.example .env.local
```

| Variabel | Isi |
|---|---|
| `GOOGLE_PROJECT_ID` / `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Kredensial service account GCP (BigQuery Data Editor + Job User) |
| `LARK_APP_ID` / `LARK_APP_SECRET` | Dari Lark Developer Console |
| `LARK_OPEN_BASE_URL` | `https://open.larksuite.com` (Lark internasional) atau `https://open.feishu.cn` (Feishu) |
| `APP_BASE_URL` | URL publik aplikasi (dipakai membangun `redirect_uri`) |
| `SESSION_SECRET` | String acak ≥32 karakter (`openssl rand -base64 48`) |
| `ADMIN_EMAILS` | Email administrator aplikasi, dipisah koma |
| `GA_DEPARTMENT_NAMES` | Nama departemen GA di Lark, dipisah koma (default: `General Affairs,GA`) |

### 5. Jalankan

```bash
npm run dev      # development → http://localhost:3000
npm run build && npm run start   # production
npm run lint
```

> Membuka aplikasi di browser biasa juga bisa: Anda akan diarahkan ke halaman login akun Lark (bukan login buatan sendiri), lalu kembali ke aplikasi.

## API

Semua endpoint (kecuali `/api/auth/*`) memerlukan session; tanpa session → `401`.

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/auth/login` | Mulai SSO → redirect ke otorisasi Lark (`?redirect_to=` path tujuan) |
| `POST` | `/api/auth/login` | Login via JSAPI: body `{ code }` dari `tt.requestAccess` (alternatif) |
| `GET` | `/api/auth/callback` | Callback OAuth: verifikasi `state`, tukar `code`, sinkron user, set session |
| `GET` | `/api/auth/me` | Identitas user dari session |
| `POST` | `/api/auth/logout` | Hapus session aplikasi |
| `GET` | `/api/vehicles` | Daftar kendaraan + status |
| `POST` | `/api/vehicles` | Tambah kendaraan (**GA/ADMIN**) |
| `PATCH` | `/api/vehicles/:id` | Ubah data/status kendaraan (**GA/ADMIN**) |
| `GET` | `/api/bookings` | Semua booking (kalender) + nama kendaraan & plat |
| `POST` | `/api/bookings` | Buat booking `{ vehicle_id, start_time, end_time, purpose }` — pemohon & supervisor otomatis dari session/Lark; 409 jika bentrok |
| `GET` | `/api/bookings/pending` | Antrian saya: `{ supervisorQueue, gaQueue, role }` |
| `GET` | `/api/bookings/history` | Riwayat: `{ mine, processed, canApprove }` — `processed` = yang pernah diproses user (supervisor/GA/ADMIN) |
| `PATCH` | `/api/bookings/:id` | `{ action: "APPROVE"\|"REJECT"\|"CANCEL", new_vehicle_id?, reason? }` — tahap & otorisasi ditentukan server; CANCEL oleh pemohon/ADMIN membebaskan slot; GA boleh kirim `new_vehicle_id`+`reason` hanya bila kendaraan bermasalah |

### Proses sinkronisasi user

Setiap login sukses: profil + struktur org diambil segar dari Lark → di-MERGE (upsert) ke `onda_booking_db.users` → role dihitung ulang → session baru diterbitkan. Perubahan organisasi (pindah departemen, ganti atasan, promosi) berlaku saat login berikutnya (session paling lama 1 hari). Selain itu, otorisasi approval **membaca ulang role terkini dari tabel `users`** setiap aksi — jadi user yang di-offboard/demote di Lark langsung kehilangan hak approval begitu profilnya tersinkron ulang, tanpa menunggu session habis. Tidak ada pengelolaan user manual.

## Struktur Project

```
src/
├── proxy.js                   # Proteksi global (Next 16, pengganti middleware.js)
├── components/
│   ├── AuthContext.js         # Provider identitas user (/api/auth/me)
│   └── Navbar.js              # Navigasi + identitas & role user
├── lib/
│   ├── api.js                 # getJson() — fetch helper dengan penanganan error
│   ├── auth.js                # JWT session (jose), cookies, requireAuth()
│   ├── bigquery.js            # getBigQuery() — client BigQuery lazy-init
│   ├── lark.js                # Klien Lark: OAuth, user_info, Contact API, tenant token
│   ├── roles.js               # resolveRole() dari data organisasi Lark
│   ├── sso.js                 # loginWithCode(): profil → sinkron → session
│   └── users.js               # upsertUser()/getUserByLarkId() (BigQuery MERGE)
├── pages/
│   ├── _app.js                # AuthProvider + Navbar global
│   ├── index.js               # Kalender booking (+ pilihan kendaraan)
│   ├── approval.js            # Antrian supervisor & GA
│   ├── security.js            # Dashboard security
│   ├── auth-error.js          # Halaman publik kegagalan SSO
│   └── api/
│       ├── auth/{login,callback,me,logout}.js
│       ├── vehicles/index.js
│       └── bookings/{index,pending,[id]}.js
└── styles/globals.css
```

## Catatan Keamanan

- Cookie session: `httpOnly` + `SameSite=Lax` + `Secure` (otomatis saat `APP_BASE_URL` https); JWT HS256, umur 1 hari.
- OAuth `state` diverifikasi via cookie nonce (anti-CSRF); `redirect_to` divalidasi ketat hanya path internal — menolak URL absolut, `//`, dan bypass backslash `/\` (anti open-redirect).
- Endpoint `POST /api/auth/login` (jalur JSAPI) menolak permintaan lintas-situs (`Sec-Fetch-Site`/`Origin`) untuk mencegah login-CSRF/session fixation.
- Pesan error internal (nama env, error BigQuery/Lark) hanya masuk log server; user menerima pesan generik.
- Otorisasi approval dicek server-side per tahap dengan role terkini dari DB; transisi status memakai precondition (`WHERE status = @expected`) sehingga bebas race double-approve. Cek bentrok saat buat booking bersifat best-effort (BigQuery bukan OLTP) — cukup untuk pemakaian internal, dengan gerbang approval GA sebagai lapis kedua.
- `App Secret`, private key GCP, dan token Lark tidak pernah menyentuh frontend.

## Keterbatasan & Langkah Lanjutan

- Notifikasi Lark (kirim pesan bot ke supervisor saat ada pengajuan, ke pemohon saat disetujui) belum ada — kandidat berikutnya via `im:message` API.
- Data user disinkron saat login; jika butuh sinkronisasi berkala massal, tambahkan cron yang menelusuri `contact/v3/users/find_by_department`.
- Field `Direct manager` yang kosong di Lark membuat pengajuan langsung masuk antrian GA (by design, tapi perlu disiplin data HR).
- Dashboard Security memakai zona waktu perangkat yang membukanya untuk menentukan "hari ini" — set zona waktu PC gerbang ke WIB (Asia/Jakarta).
- `GET /api/bookings` mengambil seluruh booking (tanpa paginasi). Cukup untuk volume internal; bila data membesar, tambahkan filter rentang tanggal + partisi tabel pada `start_time`.
- Cek bentrok booking best-effort (BigQuery bukan OLTP): dua pengajuan tumpang-tindih yang benar-benar bersamaan bisa lolos keduanya — tertangkap saat approval GA.
