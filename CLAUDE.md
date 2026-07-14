# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sistem booking mobil kantor internal PT. Onda Mega Integra, terintegrasi Lark: user membuka aplikasi dari Lark Workplace dan login otomatis via Lark SSO. Approval berjenjang mengikuti struktur organisasi Lark (supervisor = `leader_user_id`), final oleh General Affairs, hasil tampil di dashboard Security. Data di Google BigQuery (dataset `onda_booking_db`), UI berbahasa Indonesia.

## Commands

```bash
npm run dev      # dev server (http://localhost:3000)
npm run build    # production build (Turbopack)
npm run start    # serve hasil build
npm run lint     # eslint . (Next 16 tidak lagi punya `next lint`)
```

Tidak ada test suite. Verifikasi dengan `npm run build` + `npm run lint`, lalu smoke test manual.

## Environment

Tanpa `.env.local` aplikasi tidak jalan: BigQuery (`GOOGLE_*`), Lark (`LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_OPEN_BASE_URL`, `APP_BASE_URL`), session (`SESSION_SECRET` ≥32 char), role mapping (`ADMIN_EMAILS`, `GA_DEPARTMENT_NAMES`). Lihat `.env.example`. Error konfigurasi dikembalikan sebagai JSON/halaman error yang jelas, bukan crash.

## Architecture

Next.js 16 **Pages Router** (jangan buat `src/app/` — konflik route). React 19, Tailwind v4, JavaScript. Semua akses eksternal (BigQuery, Lark) hanya dari server side.

**Rantai autentikasi:** `src/proxy.js` (Next 16: pengganti `middleware.js`, Node runtime) memvalidasi JWT cookie `vb_session` untuk SEMUA route kecuali `/api/auth/*`, `/auth-error`, dan aset statis. Tanpa session: API → 401 JSON; halaman → redirect `/api/auth/login` → authorize Lark (auto-consent di dalam klien Lark) → `/api/auth/callback` (verifikasi state, tukar code, sinkron user, set cookie) → kembali ke halaman semula.

- `src/lib/lark.js` — satu-satunya tempat memanggil Lark API. Endpoint terverifikasi (Juli 2026): authorize `accounts.larksuite.com/open-apis/authen/v1/authorize` (param `client_id`, BUKAN `app_id`); token `POST /open-apis/authen/v2/oauth/token`; profil `GET /open-apis/authen/v1/user_info`; org `GET /open-apis/contact/v3/users/{open_id}` + `departments/{id}` dengan tenant token.
- `src/lib/auth.js` — JWT session (jose HS256, 1 hari), cookie helpers (`Secure` diturunkan dari `APP_BASE_URL` https, bukan NODE_ENV), `requireAuth(handler, {roles})` untuk API routes.
- `src/lib/redirect.js` — `safeInternalPath()`: validasi anti open-redirect (tolak absolut, `//`, dan backslash `/\`). Dipakai login.js & callback.js.
- **Reset Session** (bukan logout — user tetap SSO Lark): tombol di Navbar → overlay loading INSTAN → POST `/api/auth/refresh` → `window.location.reload()`. `refresh.js` memanggil `refreshSession(open_id)` (`sso.js`) → `refreshProfileByOpenId()` (`lark.js`) yang mengambil ulang data organisasi via tenant token TANPA OAuth (pakai open_id session), recompute role, terbitkan session cookie baru. `buildProfileFromOpenId()` dipakai bersama oleh `fetchLarkProfile` (login) & refresh. `_app.js` menyembunyikan navbar/footer di `/auth-error` (BARE_PAGES).
- `src/lib/api.js` — `getJson()`/`sendJson()`: fetch frontend; 401 otomatis redirect ke SSO (query dipertahankan). Jangan `.map`/`.filter` respons tanpa ini.
- Avatar: URL foto Lark (`users.avatar_url`, dari Contact API `avatar_240`, di-refresh tiap login/reset) adalah **CDN publik** (feishucdn/larksuitecdn) — dipakai LANGSUNG di `<img>` via `src/components/Avatar.js` (`referrerPolicy="no-referrer"` cegah 403 hotlink; `onError` → fallback inisial berwarna). Avatar current user ada di JWT (`avatar`) + `/api/auth/me`. Avatar pemohon di query booking via `LEFT JOIN users` (`requester_avatar`). Direktori foto semua user: `GET /api/users/directory` (open_id→{name,avatar}, cache 60s), dimuat sekali di `AuthContext` → `avatarOf(openId)`. Komponen `Person` (nama+avatar) & `AuditLine` (di `BookingStatus.js`, pakai `actorId()` untuk ambil open_id dari string audit "Nama (ou_xxx)") menampilkan foto di SETIAP nama (supervisor/GA approver, dll).
- Notifikasi aksi pakai `src/components/Toast.js` (fixed/melayang, auto-hilang) supaya feedback tidak menggeser layout. `errorMsg` inline hanya untuk error saat load. Avatar `<img>` selalu punya width/height eksplisit → tanpa layout shift (CLS).
- `src/lib/sso.js` — `loginWithCode()`: profil Lark → upsert users → session cookie.
- `src/lib/notify.js` — notifikasi bot Lark via `sendLarkMessage()` (im/v1/messages, tenant token). `notifyBookingCreated` (→ supervisor / GA) & `notifyTransition` (→ GA berikutnya / pemohon saat approve/reject). Best-effort: dibungkus try/catch di API, kegagalan TIDAK menggagalkan booking/approval. Butuh setup Lark: kapabilitas Bot + scope `im:message:send_as_bot` + visible range + rilis versi. Tanpa itu, notifikasi diam-diam gagal (log saja).
- `src/lib/users.js` — MERGE (upsert DML) ke `users` setiap login = auto-provisioning + sinkronisasi.
- `src/lib/roles.js` — `resolveRole()`: ADMIN (open_id di `ADMIN_LARK_IDS`, atau email di `ADMIN_EMAILS`) > GA (nama departemen) > GM/MANAGER (job title / leader dept) > STAFF. Dihitung ulang tiap login; JANGAN tambahkan pengelolaan role manual. ADMIN bisa memproses semua tahap approval (supervisor mana pun + GA); di `pending.js` ADMIN melihat SELURUH antrian Pending Supervisor + Pending GA. open_id user dicetak ke log saat login (`[Lark login]`).
- API bookings: `index.js` (GET kalender, POST buat — supervisor di-assign dari `users.leader_user_id`, kendaraan harus `status='Ready'`), `pending.js` (antrian saya, ikut `vehicle_status`), `[id].js` (PATCH transisi; GA APPROVE bisa ganti armada bila kendaraan bermasalah — lihat bawah).
- Armada: `src/lib/vehicleStatus.js` (konstanta status, `isVehicleAvailable` = 'Ready', `vehicleSpecText` = "7 orang · Bensin"), API `vehicles/index.js` (GET semua + POST GA/ADMIN) & `vehicles/[id].js` (PATCH GA/ADMIN), halaman `/armada`. Kolom info tambahan: `capacity`, `fuel_type`, `notes` (semua STRING; dikelola GA di /armada, tampil saat user memilih mobil di modal booking). Status kendaraan (`Ready|In Use|Maintenance|Unavailable`) langsung memengaruhi ketersediaan booking — hanya 'Ready' yang bisa dipesan (POST divalidasi + modal booking hanya menampilkan Ready yang bebas di jam terpilih).
- **GA ganti armada** (`[id].js`): saat APPROVE tahap GA, boleh set `new_vehicle_id`+`reason` HANYA jika kendaraan yang dibooking `status != 'Ready'` (bermasalah); alasan WAJIB; pengganti harus 'Ready' + tidak bentrok. Menulis `original_vehicle_id`, `vehicle_change_reason/by/at`. Alasan tampil ke pemohon di detail & riwayat (`vehicleChangeNote`).
- Menu Security dinonaktifkan sementara: `src/pages/security.js` di-comment (stub + kode asli dalam blok komentar), link navbar di-comment. Untuk aktifkan lagi: balikkan keduanya.
- Frontend: `AuthContext` (identitas via `/api/auth/me`), halaman di `src/pages/`. Navbar menampilkan menu Approval hanya bila `is_supervisor || GA || ADMIN`; `is_supervisor` = leader departemen Lark ATAU ada bawahan (`hasSubordinates`, dicek di `sso.js` saat login). Divisi pemohon disimpan di `bookings.requester_department` (snapshot saat buat) dan ditampilkan di approval/detail/security. Halaman `/riwayat` (menu semua user) punya dua tab dari GET `/api/bookings/history`: "Booking Saya" (pengajuan sendiri + aksi Batalkan) dan "Riwayat Persetujuan" (hanya supervisor/GA/ADMIN; dicari via `STRPOS(*_action_by, open_id)`; ADMIN melihat semua). Utilitas badge/audit/format di `src/components/BookingStatus.js` — dipakai halaman booking (modal detail) & riwayat.

## Status State Machine (kontrak antar-komponen, jangan diubah sepihak)

String status dipakai oleh API, halaman approval, dan kalender. Kalender di `index.js` HANYA menampilkan booking AKTIF (`Approved` hijau, `Pending*` kuning); `Rejected*` & `Cancelled*` DISEMBUNYIKAN dari kalender (`isActiveBooking`) — tetap muncul di Riwayat user. Booking dibuat lewat modal: pilih jam dulu → pilih kendaraan Ready yang BEBAS di jam itu (`vehiclesFreeForSlot`, cek bentrok client-side terhadap event aktif; server tetap validasi 409).

- Booking baru: pemohon punya supervisor → `Pending Supervisor` (dengan `supervisor_id`); tidak punya → `Pending GA`. Supervisor di-resolve di `lark.js`: `contact.leader_user_id` (direct manager), FALLBACK ke leader departemen bila kosong. Semua open_id.
- `Pending Supervisor`: hanya user dengan open_id == `supervisor_id` (atau ADMIN). APPROVE → `Pending GA`; REJECT → `Rejected By Supervisor`
- `Pending GA`: hanya role GA/ADMIN. APPROVE → `Approved`; REJECT → `Rejected By GA`
- CANCEL: pemohon (open_id == `requester_id`) atau ADMIN, dari status aktif (`Pending*`/`Approved`) → `Cancelled By User`. Slot dibebaskan.
- Setiap transisi approval menulis audit `{supervisor|ga}_action_by/_at`

Cek bentrok mengabaikan status `Rejected*` DAN `Cancelled*`. Otorisasi tahap supervisor = pencocokan `supervisor_id`, BUKAN role. Role hanya untuk gerbang GA/ADMIN dan tampilan.

## Lark Gotchas

- **Dua bentuk respons berbeda**: endpoint OAuth v2 (`authen/v2/oauth/token`) balas top-level dengan `code` STRING `"0"`; API klasik (user_info, contact, tenant token) balas envelope `{ code: 0 (int), msg, data }`. Jangan disamakan.
- `tenant_access_token` di-cache module-level (kedaluwarsa ±2 jam, refresh 5 menit lebih awal). Jangan minta token baru per request.
- Semua ID user memakai **open_id** (`user_id_type=open_id`); `leader_user_id` mengikuti tipe ini. Konsisten — jangan campur union_id/user_id.
- Scope aplikasi minimal: `contact:contact:readonly_as_app` (+ `contact:user.email:readonly` opsional). Selain scope, **Data Permission range** kontak juga harus mencakup semua karyawan (error 41050 jika tidak).
- Redirect URL di console dicocokkan **exact** — `APP_BASE_URL` harus persis sama dengan yang didaftarkan.
- Feishu (China) vs Lark internasional hanya beda domain — atur via `LARK_OPEN_BASE_URL` (accounts domain diturunkan otomatis di `lark.js`).

## BigQuery Gotchas

- **INSERT harus DML query, bukan `table.insert()`** — streaming buffer tidak bisa di-UPDATE (~90 menit), padahal approval memakai UPDATE. Upsert users memakai MERGE (juga DML).
- **Operasi bersyarat pakai `runDml()`** (named export di `bigquery.js`) yang mengembalikan `numDmlAffectedRows`. Booking insert = `INSERT ... SELECT ... WHERE NOT EXISTS (bentrok)` → 0 baris = bentrok. Approval = `UPDATE ... WHERE id=@id AND status=@expected` → 0 baris = sudah diproses orang lain (409). CATATAN: UPDATE ke baris sama benar-benar serialize (snapshot isolation), jadi cek approval bebas race. Tapi INSERT append-only TIDAK saling konflik — dua booking tumpang-tindih dalam window job yang sama bisa lolos keduanya; cek bentrok ini best-effort (BigQuery bukan OLTP, tanpa unique constraint), diterima untuk tool internal volume kecil + gerbang approval GA.
- Otorisasi approval (MUTASI) membaca role dari `getUserByLarkId()` (tabel users), BUKAN klaim JWT — supaya revocation Lark berlaku cepat. `getUserByLarkId` di-cache module-level (TTL 30 dtk) untuk menekan latensi.
- **Performa (BigQuery = OLAP, tiap query ~0.5–1.5 dtk):** endpoint READ (`pending.js`, `history.js`) memakai role dari JWT (`req.user`) tanpa query users tambahan; query independen dijalankan `Promise.all` (paralel); `runDml` hemat 1 round-trip. Frontend memakai **optimistic update** (approval, armada status, cancel) — UI berubah seketika, request jalan di belakang, revert/refetch bila gagal. Jangan tambahkan `fetch` ulang setelah aksi bila sudah optimistic.
- Kolom TIMESTAMP vs parameter string → wajib cast `TIMESTAMP(@param)`.
- Timestamp hasil query dikirim ke frontend sebagai objek `{ value: "ISO" }` — frontend baca `b.start_time.value`.
- Cek bentrok pakai strict `<`/`>` (booking back-to-back sah); `Rejected*` tidak dihitung.
- Skema tabel lengkap di README.md; dataset via konstanta `DATASET` per file API.

## Conventions

- Teks UI & pesan API bahasa Indonesia.
- API route: `requireAuth(handler)` + method check + try/catch → `res.status(...).json({ message })`. Balas pesan generik untuk 500 (detail ke `console.error` saja). Frontend pakai `getJson()`/`sendJson()` dari `src/lib/api.js`.
- Ikon lucide-react: pastikan tiap ikon ada di daftar import.
- Rahasia (App Secret, private key, token) tidak boleh menyentuh kode frontend.
