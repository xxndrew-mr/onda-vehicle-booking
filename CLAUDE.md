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
- `src/lib/api.js` — `getJson()`/`sendJson()`: fetch frontend; 401 otomatis redirect ke SSO (query dipertahankan). Jangan `.map`/`.filter` respons tanpa ini.
- `src/lib/sso.js` — `loginWithCode()`: profil Lark → upsert users → session cookie.
- `src/lib/users.js` — MERGE (upsert DML) ke `users` setiap login = auto-provisioning + sinkronisasi.
- `src/lib/roles.js` — `resolveRole()`: ADMIN (open_id di `ADMIN_LARK_IDS`, atau email di `ADMIN_EMAILS`) > GA (nama departemen) > GM/MANAGER (job title / leader dept) > STAFF. Dihitung ulang tiap login; JANGAN tambahkan pengelolaan role manual. ADMIN bisa memproses semua tahap approval (supervisor mana pun + GA); di `pending.js` ADMIN melihat SELURUH antrian Pending Supervisor + Pending GA. open_id user dicetak ke log saat login (`[Lark login]`).
- API bookings: `index.js` (GET kalender, POST buat — supervisor di-assign dari `users.leader_user_id`), `pending.js` (antrian saya), `[id].js` (PATCH transisi).
- Frontend: `AuthContext` (identitas via `/api/auth/me`), halaman di `src/pages/`. Navbar menampilkan menu Approval hanya bila `is_supervisor || GA || ADMIN`; `is_supervisor` = leader departemen Lark ATAU ada bawahan (`hasSubordinates`, dicek di `sso.js` saat login). Divisi pemohon disimpan di `bookings.requester_department` (snapshot saat buat) dan ditampilkan di approval/detail/security.

## Status State Machine (kontrak antar-komponen, jangan diubah sepihak)

String status dipakai oleh API, halaman approval, security (filter `Approved`), dan warna kalender (`Rejected*` merah, `Cancelled*` abu-abu, `Approved` hijau, sisanya kuning):

- Booking baru: pemohon punya `leader_user_id` di Lark → `Pending Supervisor` (dengan `supervisor_id`); tidak punya → `Pending GA`
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
- Otorisasi approval membaca role dari `getUserByLarkId()` (tabel users), BUKAN klaim JWT — supaya revocation Lark berlaku cepat.
- Kolom TIMESTAMP vs parameter string → wajib cast `TIMESTAMP(@param)`.
- Timestamp hasil query dikirim ke frontend sebagai objek `{ value: "ISO" }` — frontend baca `b.start_time.value`.
- Cek bentrok pakai strict `<`/`>` (booking back-to-back sah); `Rejected*` tidak dihitung.
- Skema tabel lengkap di README.md; dataset via konstanta `DATASET` per file API.

## Conventions

- Teks UI & pesan API bahasa Indonesia.
- API route: `requireAuth(handler)` + method check + try/catch → `res.status(...).json({ message })`. Balas pesan generik untuk 500 (detail ke `console.error` saja). Frontend pakai `getJson()`/`sendJson()` dari `src/lib/api.js`.
- Ikon lucide-react: pastikan tiap ikon ada di daftar import.
- Rahasia (App Secret, private key, token) tidak boleh menyentuh kode frontend.
