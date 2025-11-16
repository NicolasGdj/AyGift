import express from 'express';
import { Op } from 'sequelize';
import { Item, Category, ItemBook } from '../dao/index.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'uploads');

async function ensureImagesDir() {
  try { await fs.mkdir(IMAGES_DIR, { recursive: true }); } catch (_) {}
}

async function downloadImage(imageUrl) {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return null;
  try {
    await ensureImagesDir();
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const arrayBuf = await res.arrayBuffer();
    let extGuess = contentType.split('/')[1] || 'jpg';
    // Try to get extension from URL if present
    try {
      const urlObj = new URL(imageUrl);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
      if (match) extGuess = match[1];
    } catch (_) {}
    const fileName = `${randomUUID()}.${extGuess}`;
    const filePath = path.join(IMAGES_DIR, fileName);
    await fs.writeFile(filePath, Buffer.from(arrayBuf));
    return `/images/uploads/${fileName}`;
  } catch (e) {
    console.error('Image download failed:', e.message);
    return null;
  }
}

async function deleteLocalImage(imagePath) {
  try {
    if (!imagePath || typeof imagePath !== 'string') return;
    if (!imagePath.startsWith('/images/uploads/')) return; // only local stored
    const filePath = path.join(IMAGES_DIR, path.basename(imagePath));
    await fs.unlink(filePath).catch(() => {});
  } catch (_) {}
}

const router = express.Router();

// GET all items with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { offset = 0, limit = 20, category_id, search, priceMin, priceMax, owned } = req.query;
    
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
    
    if (owned !== undefined) {
      where.owned = owned === 'true';
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
    const body = { ...req.body };
    if (body.image) {
      const localPath = await downloadImage(body.image);
      if (localPath) body.image = localPath; // replace with local path
    }
    const item = await Item.create(body);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// BULK create items (accepts single object or array)
router.post('/bulk', async (req, res) => {
  try {
    const payload = req.body;
    const itemsInput = Array.isArray(payload) ? payload : [payload];
    const created = [];
    const errors = [];

    const allCategories = await Category.findAll();
    const categoryByName = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));

    for (let i = 0; i < itemsInput.length; i++) {
      const raw = itemsInput[i];
      try {
        if (!raw.name) throw new Error('Missing name');

        let categoryId = raw.category_id;
        if (!categoryId) {
          if (raw.category_name) {
            const key = raw.category_name.toLowerCase();
            let cat = categoryByName.get(key);
            if (!cat) {
              cat = await Category.create({ name: raw.category_name, description: raw.category_description || null });
              categoryByName.set(key, cat);
            }
            categoryId = cat.id;
          } else {
            throw new Error('Missing category_id or category_name');
          }
        }

        let imagePath = null;
        if (raw.image) {
          imagePath = await downloadImage(raw.image);
        }

        const toCreate = {
          category_id: categoryId,
          name: raw.name,
          description: raw.description || null,
          price: raw.price || null,
          link: raw.link || null,
          image: imagePath || null,
          owned: !!raw.owned,
          last_interest_date: raw.last_interest_date || new Date().toISOString()
        };

        const item = await Item.create(toCreate);
        created.push(item);
      } catch (e) {
        errors.push({ index: i, name: raw.name, error: e.message });
      }
    }

    res.status(errors.length ? 207 : 201).json({ created, errors });
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
    // Delete bookings referencing this item first to satisfy FK constraints
    await ItemBook.destroy({ where: { item_id: item.id } });
    await deleteLocalImage(item.image);
    await item.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
