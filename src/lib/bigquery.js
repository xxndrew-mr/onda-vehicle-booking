import { BigQuery } from '@google-cloud/bigquery';
import { createPrivateKey } from 'crypto';

let client = null;

/**
 * Normalisasi private key service account dari env agar tahan terhadap SEMUA
 * cara value bisa rusak, terutama saat di-set lewat env platform hosting
 * (Vercel/Docker/systemd/PM2) yang TIDAK memakai dotenv:
 * - tanda kutip (" atau ') ikut ter-copy
 * - newline tersimpan sebagai `\n` literal (bukan baris baru asli)
 * - CRLF (`\r\n`) dari copy-paste Windows
 * - seluruh key di-encode base64 (cara paling anti-rusak; pakai via
 *   env GOOGLE_PRIVATE_KEY_BASE64, atau langsung di GOOGLE_PRIVATE_KEY)
 * Tanpa ini OpenSSL gagal decode → ERR_OSSL_UNSUPPORTED.
 */
export function normalizePrivateKey(raw) {
  let key = String(raw).trim();

  // Buang sepasang kutip pembungkus bila ada.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  // Kalau tidak terlihat seperti PEM, mungkin base64 dari PEM → coba decode.
  if (!key.includes('PRIVATE KEY')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('PRIVATE KEY')) key = decoded.trim();
    } catch {
      // biarkan; validasi di bawah yang akan memberi pesan jelas
    }
  }

  return key
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
}

/**
 * Lazy-init client BigQuery. Dipanggil di dalam try/catch handler API
 * supaya error konfigurasi env dikembalikan sebagai respons JSON yang jelas,
 * bukan crash saat module di-import.
 */
export default function getBigQuery() {
  if (client) return client;

  const { GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PRIVATE_KEY_BASE64 } =
    process.env;
  const rawKey = GOOGLE_PRIVATE_KEY_BASE64 || GOOGLE_PRIVATE_KEY;

  if (!GOOGLE_PROJECT_ID || !GOOGLE_CLIENT_EMAIL || !rawKey) {
    throw new Error(
      'Konfigurasi BigQuery belum lengkap. Set GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, ' +
        'dan GOOGLE_PRIVATE_KEY (atau GOOGLE_PRIVATE_KEY_BASE64) di env (lihat .env.example).'
    );
  }

  const privateKey = normalizePrivateKey(rawKey);

  // Validasi lebih awal dengan pesan yang jelas — supaya kegagalan format tidak
  // muncul sebagai ERR_OSSL_UNSUPPORTED yang membingungkan.
  try {
    createPrivateKey(privateKey);
  } catch {
    throw new Error(
      'GOOGLE_PRIVATE_KEY tidak bisa di-parse sebagai private key yang valid. ' +
        'Bila di-set lewat env platform hosting: JANGAN bungkus dengan tanda kutip, ' +
        'atau paling aman gunakan GOOGLE_PRIVATE_KEY_BASE64 (nilai = base64 dari private_key). ' +
        `Panjang value terbaca: ${privateKey.length} char, diawali "${privateKey.slice(0, 11)}".`
    );
  }

  client = new BigQuery({
    projectId: GOOGLE_PROJECT_ID,
    credentials: { client_email: GOOGLE_CLIENT_EMAIL, private_key: privateKey },
  });

  return client;
}

/**
 * Jalankan DML (INSERT/UPDATE/MERGE) dan kembalikan jumlah baris terpengaruh.
 * Dipakai untuk operasi atomik "conditional write" (INSERT ... WHERE NOT EXISTS,
 * UPDATE ... WHERE status = @expected) supaya bebas dari race check-then-write.
 */
export async function runDml(query, params) {
  const bigquery = getBigQuery();
  const [job] = await bigquery.createQueryJob({ query, params });
  await job.getQueryResults();
  const [meta] = await job.getMetadata();
  return Number(meta.statistics?.query?.numDmlAffectedRows || 0);
}
