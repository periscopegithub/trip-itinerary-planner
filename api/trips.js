import { ensureSchema, getDb } from './_lib/db.js';
import { checkAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  await ensureSchema();
  const db = getDb();

  if (req.method === 'GET') {
    const { rows } = await db.query(
      'SELECT id, name, data, updated_at FROM trips ORDER BY updated_at DESC'
    );
    const trips = rows.map(r => {
      const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      return {
        id: r.id,
        name: r.name,
        days: data.days || [],
        updatedAt: r.updated_at,
        dayCount: (data.days || []).length,
      };
    });
    return res.status(200).json(trips);
  }

  if (req.method === 'POST') {
    const trip = req.body;
    if (!trip || !trip.id || !trip.name || !Array.isArray(trip.days)) {
      return res.status(400).json({ error: 'Invalid trip: need id, name, days' });
    }
    await db.query(
      `INSERT INTO trips (id, name, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = NOW()`,
      [trip.id, trip.name, JSON.stringify(trip)]
    );
    return res.status(201).json({ ok: true, id: trip.id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
