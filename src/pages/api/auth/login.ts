import type { NextApiRequest, NextApiResponse } from 'next';
import { config } from '../../../lib/config';
import { setSessionCookie, signSession } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body as { username?: string; password?: string };

  if (username !== config.appUsername || password !== config.appPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signSession(username);
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true });
}
