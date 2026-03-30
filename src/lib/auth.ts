import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';
import type { NextApiRequest, NextApiResponse } from 'next';
import { config } from './config';

const COOKIE_NAME = 'usp_session';

export function signSession(username: string) {
  return jwt.sign({ username }, config.jwtSecret, { expiresIn: '7d' });
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, config.jwtSecret) as { username: string };
}

export function getSession(req: NextApiRequest) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const cookies = parse(raw);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(req: NextApiRequest, res: NextApiResponse) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return session;
}

export function setSessionCookie(res: NextApiResponse, token: string) {
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    })
  );
}

export function clearSessionCookie(res: NextApiResponse) {
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0)
    })
  );
}
