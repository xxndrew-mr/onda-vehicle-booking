import getBigQuery from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';

const DATASET = 'onda_booking_db';

// Direktori foto profil semua user (open_id → avatar_url). Di-cache module-level
// (TTL 60 dtk) supaya tidak query BigQuery tiap halaman.
let cache = { data: null, at: 0 };
const TTL_MS = 60 * 1000;

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  try {
    if (cache.data && Date.now() - cache.at < TTL_MS) {
      return res.status(200).json(cache.data);
    }
    const bigquery = getBigQuery();
    const [rows] = await bigquery.query(
      `SELECT lark_user_id, name, avatar_url FROM \`${DATASET}.users\``
    );
    const map = {};
    for (const r of rows) {
      if (r.lark_user_id) map[r.lark_user_id] = { name: r.name || '', avatar: r.avatar_url || '' };
    }
    cache = { data: map, at: Date.now() };
    return res.status(200).json(map);
  } catch (error) {
    console.error('API /api/users/directory error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
