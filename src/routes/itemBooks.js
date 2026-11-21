import express from 'express';
import { Transaction } from 'sequelize';
import { sequelize, Item, ItemBook } from '../dao/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { createGuestToken, isAnonymousBooking, normalizeGuestName, ownsBooking, readGuest } from '../middleware/guest.js';

const router = express.Router();

function requireGuest(req, res, next) {
  const guest = readGuest(req);
  if (!guest) return res.status(401).json({ error: 'Session invité requise.' });
  req.guest = guest;
  next();
}

router.post('/session', (req, res) => {
  const name = normalizeGuestName(req.body?.name);
  if (!name || name.length > 255 || isAnonymousBooking(name)) {
    return res.status(400).json({ error: 'Saisissez un prénom ou un nom valide.' });
  }
  res.set('Cache-Control', 'no-store').json({ token: createGuestToken(name), name });
});

router.get('/:itemId', requireGuest, async (req, res, next) => {
  try {
    const item = await Item.findByPk(req.params.itemId);
    if (!item || item.owned) return res.status(404).json({ error: 'Article indisponible.' });

    const rows = await ItemBook.findAll({
      where: { item_id: item.id },
      order: [['date', 'DESC'], ['user', 'ASC']]
    });
    const reservations = rows.map(({ user, date }) => {
      if (isAnonymousBooking(user)) return { name: null, date: null, own: false };
      return { name: user, date, own: ownsBooking(req.guest, user) };
    });
    res.set('Cache-Control', 'no-store').json({ reservations });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireGuest, async (req, res, next) => {
  try {
    const { item_id, interested } = req.body || {};
    if (typeof interested !== 'boolean') return res.sendStatus(400);

    // Serialize the read and write so two sessions with the same name create only one reservation.
    const result = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async transaction => {
      const item = await Item.findByPk(item_id, { transaction });
      if (!item || item.owned) return null;

      const where = { item_id: item.id };
      const bookings = await ItemBook.findAll({ where, transaction });
      const own = bookings.filter(booking => ownsBooking(req.guest, booking.user));
      let count = bookings.length;
      if (interested && !own.length) {
        await ItemBook.create({ ...where, user: req.guest.name }, { transaction });
        count++;
      } else if (!interested && own.length) {
        await ItemBook.destroy({ where: { ...where, user: [...new Set(own.map(booking => booking.user))] }, transaction });
        count -= own.length;
      }
      return { user_interested: interested, booking_count: count };
    });
    if (!result) return res.status(404).json({ error: 'Article indisponible.' });
    res.set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:itemId?', authenticateToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { itemId } = req.params;
    await ItemBook.destroy({ where: itemId ? { item_id: itemId } : {} });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

export default router;
