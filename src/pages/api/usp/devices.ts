import type { NextApiRequest, NextApiResponse } from 'next';
import { uspClient } from '../../../lib/uspClient';

/**
 * GET /api/usp/devices
 * Returns the list of known devices from the database.  Devices that have
 * recently sent messages are marked as online; others are offline.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const devices = await uspClient.getDevices();
    return res.status(200).json({ devices });
  } catch (err: any) {
    console.error('Failed to fetch devices', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}