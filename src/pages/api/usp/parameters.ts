import type { NextApiRequest, NextApiResponse } from 'next';
import { uspClient } from '../../../lib/uspClient';

/**
 * API endpoint for parameter operations.  Supports the following:
 *
 * - GET: send a Get request for one or more parameter paths.  Requires
 *   `endpointId` and `paths` query parameters.  `paths` may be a comma
 *   separated string of USP parameter paths.  Returns a confirmation that
 *   the request was sent; the actual values will be received asynchronously
 *   and shown in the log.
 * - POST: send a Set request to update one or more parameters.  The body
 *   should contain `endpointId` and `params` (object).  Returns a
 *   confirmation on success.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { endpointId } = req.query as { endpointId?: string };
  if (!endpointId) {
    return res.status(400).json({ error: 'Missing endpointId' });
  }
  try {
    if (req.method === 'GET') {
      const pathsParam = (req.query.paths as string) || '';
      const paths = pathsParam.split(',').map((p) => p.trim()).filter(Boolean);
      if (paths.length === 0) {
        return res.status(400).json({ error: 'Missing parameter paths' });
      }
      await uspClient.sendGet(endpointId, paths);
      return res.status(200).json({ status: 'Get request sent' });
    } else if (req.method === 'POST') {
      const { params } = req.body || {};
      if (!params || typeof params !== 'object') {
        return res.status(400).json({ error: 'Missing params object' });
      }
      await uspClient.sendSet(endpointId, params);
      return res.status(200).json({ status: 'Set request sent' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err: any) {
    console.error('Parameter API error', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}