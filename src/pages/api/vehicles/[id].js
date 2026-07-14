import { runDml } from '../../../lib/bigquery';
import { requireAuth } from '../../../lib/auth';
import { getUserByLarkId } from '../../../lib/users';
import { VEHICLE_STATUSES } from '../../../lib/vehicleStatus';

const DATASET = 'onda_booking_db';

/**
 * Ubah data/status kendaraan — hanya GA (dan ADMIN). Perubahan status langsung
 * memengaruhi ketersediaan pada proses booking (hanya 'Ready' yang bisa dipesan).
 */
async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  try {
    const me = await getUserByLarkId(req.user.sub);
    if (!me) {
      return res.status(401).json({ message: 'Profil user tidak ditemukan. Silakan login ulang.' });
    }
    if (me.role !== 'GA' && me.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Hanya General Affairs yang bisa mengelola armada.' });
    }

    const { name, license_plate, status } = req.body || {};

    // Bangun SET dinamis hanya untuk field yang dikirim.
    const sets = [];
    const params = { id };
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: 'Nama kendaraan tidak boleh kosong.' });
      sets.push('name = @name');
      params.name = String(name).trim();
    }
    if (license_plate !== undefined) {
      sets.push('license_plate = @license_plate');
      params.license_plate = String(license_plate).trim();
    }
    if (status !== undefined) {
      if (!VEHICLE_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Status kendaraan tidak valid.' });
      }
      sets.push('status = @status');
      params.status = status;
    }

    if (sets.length === 0) {
      return res.status(400).json({ message: 'Tidak ada perubahan.' });
    }

    const affected = await runDml(
      `UPDATE \`${DATASET}.vehicles\` SET ${sets.join(', ')} WHERE id = @id`,
      params
    );

    if (affected === 0) {
      return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    }

    return res.status(200).json({ message: 'Kendaraan diperbarui.' });
  } catch (error) {
    console.error('API /api/vehicles/[id] error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

export default requireAuth(handler);
