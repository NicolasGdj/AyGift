import express from 'express';
import { ItemBook, Item } from '../dao/index.js';

const router = express.Router();

// GET all bookings
router.get('/', async (req, res) => {
  try {
    const bookings = await ItemBook.findAll({
      include: [{ model: Item, as: 'item' }]
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET bookings for specific item
router.get('/item/:itemId', async (req, res) => {
  try {
    const bookings = await ItemBook.findAll({
      where: { item_id: req.params.itemId },
      include: [{ model: Item, as: 'item' }]
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET bookings for specific user
router.get('/user/:user', async (req, res) => {
  try {
    const bookings = await ItemBook.findAll({
      where: { user: req.params.user },
      include: [{ model: Item, as: 'item' }]
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new booking
router.post('/', async (req, res) => {
  try {
    const booking = await ItemBook.create(req.body);
    res.status(201).json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE booking
router.delete('/:itemId/:user/:date', async (req, res) => {
  try {
    const { itemId, user, date } = req.params;
    const booking = await ItemBook.findOne({
      where: { item_id: itemId, user, date }
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
router.delete('/', async (req, res) => {
  try {
    await ItemBook.destroy({ where: {}, truncate: true });
    res.json({ success: true, message: 'All bookings reset' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
