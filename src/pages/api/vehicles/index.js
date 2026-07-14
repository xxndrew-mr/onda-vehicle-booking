import { v4 as uuidv4 } from 'uuid';
import getBigQuery, { runDml } from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';
import { getUserByLarkId } from '../../../lib/users';
import { VEHICLE_STATUSES, AVAILABLE_STATUS } from '../../../lib/vehicleStatus';

const DATASET = 'onda_booking_db';

// Hanya GA (dan ADMIN sebagai superuser) yang boleh mengelola armada.
async function requireGa(req, res) {
  const me = await getUserByLarkId(req.user.sub);
  if (!me) {
    res.status(401).json({ message: 'Profil user tidak ditemukan. Silakan login ulang.' });
    return null;
  }
  if (me.role !== 'GA' && me.role !== 'ADMIN') {
    res.status(403).json({ message: 'Hanya General Affairs yang bisa mengelola armada.' });
    return null;
  }
  return me;
}

async function handler(req, res) {
  try {
    const bigquery = getBigQuery();

    if (req.method === 'GET') {
      // Daftar kendaraan + status (semua user login; halaman booking memfilter yang Ready).
      const [rows] = await bigquery.query(
        `SELECT id, name, license_plate, status FROM \`${DATASET}.vehicles\` ORDER BY name`
      );
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const me = await requireGa(req, res);
      if (!me) return;

      const { name, license_plate, status } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ message: 'Nama kendaraan wajib diisi.' });
      }
      const vStatus = status || AVAILABLE_STATUS;
      if (!VEHICLE_STATUSES.includes(vStatus)) {
        return res.status(400).json({ message: 'Status kendaraan tidak valid.' });
      }

      await runDml(
        `INSERT INTO \`${DATASET}.vehicles\` (id, name, license_plate, status)
         VALUES (@id, @name, @license_plate, @status)`,
        {
          id: uuidv4(),
          name: String(name).trim(),
          license_plate: (license_plate || '').trim(),
          status: vStatus,
        }
      );

      return res.status(201).json({ message: 'Kendaraan ditambahkan.' });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  } catch (error) {
    console.error('API /api/vehicles error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
