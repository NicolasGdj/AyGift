import express from 'express';
import { ItemBook } from '../dao/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST new booking (toggle: add if not exists, remove if exists)
router.post('/', async (req, res) => {
  try {
    const { item_id, user } = req.body;
    
    if (!item_id || !user) {
      return res.status(400).json({ error: 'item_id and user are required' });
    }
    
    const existing = await ItemBook.findOne({
      where: { item_id, user }
    });
    
    if (existing) {
      await existing.destroy();
      res.json({ success: true, action: 'removed', booking: null });
    } else {
      const booking = await ItemBook.create({ item_id, user, date: new Date() });
      res.status(201).json({ success: true, action: 'added', booking });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE booking
router.delete('/:itemId/:user', async (req, res) => {
  try {
    const { itemId, user } = req.params;
    const booking = await ItemBook.findOne({
      where: { item_id: itemId, user }
    });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    await booking.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE all bookings (admin only)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    await ItemBook.destroy({ where: {}, truncate: true });
    res.json({ success: true, message: 'All bookings reset' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
