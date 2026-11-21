import express from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JWT_SECRET, verifyToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SECRET_FILE = path.join(__dirname, '..', '.2fa-secret.json');

const router = express.Router();

// Rate limiting: 10 attempts per 5 minutes, then block for 5 minutes
const rateLimit = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BLOCK_MS = 5 * 60 * 1000; // 5 minutes

function isRateLimited(ip) {
  const now = Date.now();
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { attempts: 0, firstAttempt: now, blockedUntil: 0 });
  }
  const data = rateLimit.get(ip);
  
  if (now < data.blockedUntil) {
    return true; // Still blocked
  }
  
  if (now - data.firstAttempt > WINDOW_MS) {
    // Reset window
    data.attempts = 0;
    data.firstAttempt = now;
  }
  
  if (data.attempts >= MAX_ATTEMPTS) {
    data.blockedUntil = now + BLOCK_MS;
    return true;
  }
  
  return false;
}

function recordAttempt(ip) {
  const now = Date.now();
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { attempts: 0, firstAttempt: now, blockedUntil: 0 });
  }
  const data = rateLimit.get(ip);
  data.attempts++;
}

function loadSecret() {
  try {
    const data = readFileSync(SECRET_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    
    const { password } = req.body || {};
    const code = typeof password === 'string' ? password.replace(/\s/g, '') : '';
    if (!/^[0-9]{6}$/.test(code)) {
      recordAttempt(ip);
      return res.status(401).json({ error: 'Invalid code' });
    }

    const developmentOnly = process.env.NODE_ENV === 'development' && code === '000000';
    if (!developmentOnly) {
      const secret = loadSecret();
      if (!secret) {
        recordAttempt(ip);
        return res.status(500).json({ error: 'Password not configured' });
      }

      const verified = speakeasy.totp.verify({
        secret: secret.ascii,
        encoding: 'ascii',
        token: code,
        window: 2 // Allow some time drift
      });
      if (!verified) {
        recordAttempt(ip);
        return res.status(401).json({ error: 'Invalid password' });
      }
    }
    
    const token = jwt.sign(
      { user: process.env.OWNER || 'owner', role: 'admin', ...(developmentOnly && { developmentOnly }) },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = verifyToken(token);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

export default router;
