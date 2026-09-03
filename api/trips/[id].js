import { ensureSchema, getDb } from '../_lib/db.js';
import { checkAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  await ensureSchema();
  const db = getDb();
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  if (req.method === 'GET') {
    const { rows } = await db.query('SELECT id, name, data, updated_at FROM trips WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Trip not found' });
    const r = rows[0];
    const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    return res.status(200).json({ id: r.id, name: r.name, days: data.days || [], updatedAt: r.updated_at, ...data, id: r.id, name: r.name });
  }

  if (req.method === 'PUT') {
    const trip = req.body;
    if (!trip || !trip.name || !Array.isArray(trip.days)) {
      return res.status(400).json({ error: 'Invalid trip: need name, days' });
    }
    const payload = { ...trip, id };
    const { rowCount } = await db.query(
      `INSERT INTO trips (id, name, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = NOW()`,
      [id, payload.name, JSON.stringify(payload)]
    );
    return res.status(200).json({ ok: true, id });
  }

  if (req.method === 'DELETE') {
    const { rowCount } = await db.query('DELETE FROM trips WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Trip not found' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
