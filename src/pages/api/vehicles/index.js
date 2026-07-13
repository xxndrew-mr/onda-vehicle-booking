import getBigQuery from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';

const DATASET = 'onda_booking_db';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  try {
    const bigquery = getBigQuery();
    const [rows] = await bigquery.query(
      `SELECT id, name, license_plate FROM \`${DATASET}.vehicles\` ORDER BY name`
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error('API /api/vehicles error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: error.message });
  }
}

export default requireAuth(handler);
