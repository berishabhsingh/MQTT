import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSession(req);
  res.status(200).json({ authenticated: Boolean(session), username: session?.username || null });
}
