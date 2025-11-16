import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'aygift-secret-key-change-in-production';

router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    // For now, always return OK and generate token
    // TODO: Add real password validation
    const token = jwt.sign(
      { user: 'nicolas', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
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
    
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

export default router;
