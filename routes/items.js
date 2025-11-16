import express from 'express';
import { Op } from 'sequelize';
import { Item, Category } from '../dao/index.js';

const router = express.Router();

// GET all items with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { offset = 0, limit = 20, category_id, search, priceMin, priceMax } = req.query;
    
    let where = {};
    
    if (category_id) {
      where.category_id = category_id;
    }
    
    if (priceMin || priceMax) {
      where.price = {};
      if (priceMin) where.price[Op.gte] = parseFloat(priceMin);
      if (priceMax) where.price[Op.lte] = parseFloat(priceMax);
    }
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const items = await Item.findAll({
      where,
      include: [{ model: Category, as: 'category' }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['last_interest_date', 'DESC']]
    });
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single item
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id, {
      include: [{ model: Category, as: 'category' }]
    });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new item
router.post('/', async (req, res) => {
  try {
    const item = await Item.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update item
router.put('/:id', async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    await item.update(req.body);
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE item
router.delete('/:id', async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    await item.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
