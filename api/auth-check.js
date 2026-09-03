import { checkAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  return res.status(200).json({ ok: true });
}
