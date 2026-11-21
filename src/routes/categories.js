import express from 'express';
import { Category, Item, ItemBook } from '../dao/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { removeUnusedImage } from './itemImages.js';

const router = express.Router();

// GET all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single category
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new category
router.post('/', authenticateToken, async (req, res) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update category
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    await category.update(req.body);
    res.json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    // Fetch items to remove associated local images
    const items = await Item.findAll({ where: { category_id: category.id } });
    const itemIds = items.map(i => i.id);
    if (itemIds.length) {
      // Remove bookings in a single query
      await ItemBook.destroy({ where: { item_id: itemIds } });
      await Item.destroy({ where: { category_id: category.id } });
      await Promise.all(items.map(item => removeUnusedImage(item.image)));
    }
    await category.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
