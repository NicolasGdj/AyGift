import express from 'express';
import { col, fn, Op, where as sqlWhere } from 'sequelize';
import { Item, Category, ItemBook } from '../dao/index.js';
import { readSiteSettings } from '../dao/siteSettings.js';
import { maxFeaturedIds } from '../public/js/settings.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import { ownsBooking, readGuest } from '../middleware/guest.js';
import { removeUnusedImage, storeCroppedImage } from './itemImages.js';

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

const router = express.Router();

const bookings = { model: ItemBook, as: 'bookings', attributes: ['user'] };

function withBookingMetadata(item, guest) {
  const data = item.toJSON();
  data.booking_count = data.bookings.length;
  data.user_interested = data.bookings.some(booking => ownsBooking(guest, booking.user));
  delete data.bookings;
  return data;
}

async function catalogFilters({ category_id, search, priceMin, priceMax }) {
  const where = {};
  if (category_id) where.category_id = category_id;
  if (priceMin || priceMax) {
    where.price = {};
    if (priceMin) where.price[Op.gte] = parseFloat(priceMin);
    if (priceMax) where.price[Op.lte] = parseFloat(priceMax);
  }
  if (typeof search === 'string' && search.trim()) {
    const term = search.trim();
    const contains = column => sqlWhere(fn('instr', fn('lower', col(column)), fn('lower', term)), { [Op.gt]: 0 });
    const categories = await Category.findAll({ attributes: ['id'], where: contains('name') });
    where[Op.or] = [
      contains('Item.name'),
      contains('Item.description'),
      { category_id: categories.map(category => category.id) }
    ];
  }
  return where;
}

router.get('/roulette', async (req, res, next) => {
  try {
    const { rouletteEnabled } = await readSiteSettings();
    res.set('Cache-Control', 'no-store');
    if (!rouletteEnabled) return res.sendStatus(404);
    const where = await catalogFilters(req.query);
    where.owned = false;
    const items = await Item.findAll({ attributes: ['id', 'name', 'image'], include: [bookings], where });
    const guest = readGuest(req);
    res.json(items.map(item => withBookingMetadata(item, guest)));
  } catch (error) {
    next(error);
  }
});

router.get('/featured', async (req, res, next) => {
  try {
    const { featuredEnabled, featuredLimit, featuredIds } = await readSiteSettings();
    if (!featuredEnabled || !featuredIds.length) return res.json([]);
    const items = await Item.findAll({
      where: { id: featuredIds, owned: false },
      include: [bookings]
    });
    const byId = new Map(items.map(item => [item.id, item]));
    const featured = featuredIds.map(id => byId.get(id)).filter(Boolean).slice(0, featuredLimit);
    const guest = readGuest(req);
    res.set('Cache-Control', 'no-store').json(featured.map(item => withBookingMetadata(item, guest)));
  } catch (error) {
    next(error);
  }
});

// GET all items with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { offset = 0, limit = 20, owned, ids, recent } = req.query;
    const where = await catalogFilters(req.query);
    
    if (ids !== undefined) {
      if (typeof ids !== 'string' || !/^\d+(,\d+)*$/.test(ids)) return res.sendStatus(400);
      const itemIds = ids.split(',').map(Number);
      if (itemIds.length > maxFeaturedIds || !itemIds.every(Number.isSafeInteger)) return res.sendStatus(400);
      where.id = itemIds;
    }

    if (owned !== undefined) {
      where.owned = owned === 'true';
    }
    if (recent === 'true') {
      where.owned = false;
      where.last_interest_date = { [Op.not]: null };
    }
    
    const items = await Item.findAll({
      where,
      include: [bookings],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['last_interest_date', 'DESC'], ['id', 'DESC']]
    });
    
    // Add computed fields
    const guest = readGuest(req);
    res.set('Cache-Control', 'no-store').json(items.map(item => withBookingMetadata(item, guest)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single item
router.get('/:id', async (req, res) => {
  try {
    const guest = readGuest(req);
    const item = await Item.findByPk(req.params.id, {
      include: [bookings]
    });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.set('Cache-Control', 'no-store').json(withBookingMetadata(item, guest));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new item
router.post('/', authenticateToken, express.json({ limit: '4mb' }), async (req, res) => {
  let uploaded;
  try {
    const { imageData, ...body } = req.body;
    if (imageData !== undefined) {
      uploaded = await storeCroppedImage(imageData);
      body.image = uploaded;
    } else if (body.image) {
      const localPath = await downloadImage(body.image);
      if (localPath) body.image = uploaded = localPath;
    }
    const item = await Item.create(body);
    res.status(201).json(item);
  } catch (error) {
    await removeUnusedImage(uploaded);
    res.status(400).json({ error: error.message });
  }
});

// BULK create items (accepts single object or array)
router.post('/bulk', authenticateToken, express.json(), async (req, res) => {
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
          price: raw.price ?? null,
          link: raw.link || null,
          image: imagePath || null,
          owned: !!raw.owned,
          last_interest_date: raw.last_interest_date || null
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
router.put('/:id', authenticateToken, express.json({ limit: '4mb' }), async (req, res) => {
  let uploaded;
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const previousImage = item.image;
    const { imageData, ...body } = req.body;
    if (imageData !== undefined) {
      uploaded = await storeCroppedImage(imageData);
      body.image = uploaded;
    }
    await item.update(body);
    if (previousImage !== item.image) await removeUnusedImage(previousImage);
    res.json(item);
  } catch (error) {
    await removeUnusedImage(uploaded);
    res.status(400).json({ error: error.message });
  }
});

// DELETE item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    // Delete bookings referencing this item first to satisfy FK constraints
    await ItemBook.destroy({ where: { item_id: item.id } });
    await item.destroy();
    await removeUnusedImage(item.image);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
