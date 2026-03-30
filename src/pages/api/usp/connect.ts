import type { NextApiRequest, NextApiResponse } from 'next';
import { uspClient } from '../../../lib/uspClient';

/**
 * API route to establish a connection to an MQTT broker.  Expects a JSON
 * payload with `url`, `username`, `password`, and `tls`.  Returns 200 on
 * success and 400 on error.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { url, username, password, tls } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'Missing broker URL' });
  }
  try {
    await uspClient.connect({ url, username, password, tls });
    return res.status(200).json({ status: 'connected' });
  } catch (err: any) {
    console.error('Failed to connect to broker', err);
    return res.status(400).json({ error: err.message || 'Connection failed' });
  }
}