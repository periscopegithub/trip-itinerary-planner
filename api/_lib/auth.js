export function checkAuth(req, res) {
  const expected = process.env.TRIPS_PASSPHRASE;
  if (!expected) {
    res.status(500).json({ error: 'Server misconfigured: TRIPS_PASSPHRASE not set' });
    return false;
  }
  const got = req.headers['x-passphrase']
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    || req.query.passphrase
    || '';
  if (got !== expected) {
    res.status(401).json({ error: 'Unauthorized: invalid passphrase' });
    return false;
  }
  return true;
}
