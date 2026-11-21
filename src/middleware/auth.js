import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'aygift-secret-key-change-in-production';

export function verifyToken(token) {
  const user = jwt.verify(token, JWT_SECRET);
  if (user.developmentOnly && process.env.NODE_ENV !== 'development') {
    throw new Error('Development session');
  }
  return user;
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}
