import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth.js';

const sessionKey = createHmac('sha256', JWT_SECRET).update('aygift:guest-session').digest();
const audience = 'aygift-guest';

export function normalizeGuestName(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
}

export function isAnonymousBooking(user) {
  return /^guest:[a-f0-9]{64}$/.test(user);
}

export function createGuestToken(name) {
  return jwt.sign({ name }, sessionKey, { audience, expiresIn: '7d' });
}

export function readGuest(req) {
  const token = req.get('X-AyGift-Guest');
  if (!token || req.get('Authorization')) return null;
  try {
    const { name } = jwt.verify(token, sessionKey, { audience });
    return name ? { name, key: normalizeGuestName(name).toLowerCase() } : null;
  } catch {
    return null;
  }
}

export function ownsBooking(guest, user) {
  return Boolean(guest && !isAnonymousBooking(user) && normalizeGuestName(user).toLowerCase() === guest.key);
}
