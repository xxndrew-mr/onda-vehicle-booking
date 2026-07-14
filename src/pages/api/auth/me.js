import { requireAuth } from '../../../lib/auth';

/** Identitas user dari session (untuk ditampilkan di UI). */
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} tidak diizinkan.` });
  }

  return res.status(200).json({
    user: {
      id: req.user.sub,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      is_supervisor: req.user.is_supervisor,
      department: req.user.department || '',
      avatar: req.user.avatar || '',
    },
  });
}

export default requireAuth(handler);
