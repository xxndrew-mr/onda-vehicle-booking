import { BigQuery } from '@google-cloud/bigquery';

let client = null;

/**
 * Lazy-init client BigQuery. Dipanggil di dalam try/catch handler API
 * supaya error konfigurasi env dikembalikan sebagai respons JSON yang jelas,
 * bukan crash saat module di-import.
 */
export default function getBigQuery() {
  if (client) return client;

  const { GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

  if (!GOOGLE_PROJECT_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error(
      'Konfigurasi BigQuery belum lengkap. Set GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, ' +
        'dan GOOGLE_PRIVATE_KEY di file .env.local (lihat contoh di .env.example).'
    );
  }

  client = new BigQuery({
    projectId: GOOGLE_PROJECT_ID,
    credentials: {
      client_email: GOOGLE_CLIENT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
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
