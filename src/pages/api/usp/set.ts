import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../lib/auth';
import { uspManager } from '../../../lib/uspManager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpointId, params } = req.body as { endpointId?: string; params?: Record<string, string> };
  if (!endpointId || !params || typeof params !== 'object') {
    return res.status(400).json({ error: 'endpointId and params are required' });
  }

  await uspManager.sendSet(endpointId, params);
  res.status(200).json({ ok: true });
}
