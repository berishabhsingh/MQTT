import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../lib/auth';
import { uspManager } from '../../../lib/uspManager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpointId, paths } = req.body as { endpointId?: string; paths?: string[] };
  if (!endpointId || !Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: 'endpointId and paths are required' });
  }

  await uspManager.sendGet(endpointId, paths);
  res.status(200).json({ ok: true });
}
