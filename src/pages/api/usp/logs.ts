import type { NextApiRequest, NextApiResponse } from 'next';
import { uspClient } from '../../../lib/uspClient';

/**
 * GET /api/usp/logs
 * Returns an array of recent USP log entries.  Each entry contains a
 * timestamp, direction ('in' or 'out'), endpoint identifiers and the
 * decoded message.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const logs = uspClient.getLogs();
  return res.status(200).json({ logs });
}