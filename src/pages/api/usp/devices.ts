import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../lib/auth';
import { uspManager } from '../../../lib/uspManager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return;
  await uspManager.ensureConnected();
  res.status(200).json({ devices: uspManager.getDevices() });
}
