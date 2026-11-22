import express from 'express';
import { readSiteSettings, SiteSettings } from '../dao/siteSettings.js';
import { authenticateToken } from '../middleware/auth.js';
import { defaultSettings, maxFeaturedIds, maxFeaturedLimit, maxFeaturedTitleLength, maxPreferenceRows, publicSiteSettings } from '../public/js/settings.js';

const router = express.Router();
const validIds = (ids) => Array.isArray(ids) && ids.every(id => Number.isSafeInteger(id) && id > 0);
const colorKeys = Object.keys(defaultSettings.colors);
const welcomeLimits = { siteName: 60, ownerName: 80, title: 120, description: 500, guestButton: 60, adminButton: 60, loginTitle: 120, loginDescription: 500 };
const validText = (value, limit) => typeof value === 'string' && value.length <= limit;
const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

router.get('/', async (_req, res, next) => {
  try {
    const settings = publicSiteSettings(await readSiteSettings());
    res.set('Cache-Control', 'no-store').json({ owner: process.env.OWNER || 'Owner', settings });
  } catch (error) {
    next(error);
  }
});

router.get('/admin', authenticateToken, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    res.set('Cache-Control', 'no-store').json({ owner: process.env.OWNER || 'Owner', settings: await readSiteSettings() });
  } catch (error) {
    next(error);
  }
});

router.put('/', authenticateToken, express.json({ limit: '256kb' }), async (req, res, next) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { colors: submittedColors, categoryOrder, categoryLayout, catalogLayout, featuredEnabled, featuredLimit, featuredIds } = req.body || {};
  const current = await readSiteSettings().catch(next);
  if (!current) return;
  const colors = { reservation: current.colors.reservation, ...submittedColors };
  const {
    recentLimit = current.recentLimit, welcome = current.welcome, sizes = current.sizes,
    categoryItemsLayout = current.categoryItemsLayout, featuredLayout = current.featuredLayout,
    featuredTitle = current.featuredTitle,
    favoriteColors = current.favoriteColors, avoidEnabled = current.avoidEnabled, avoidIntro = current.avoidIntro,
    avoidGroups = current.avoidGroups, rouletteEnabled = current.rouletteEnabled
  } = req.body || {};
  if (!colorKeys.every(key => validColor(colors[key])) ||
      !validIds(categoryOrder) || !['bar', 'sidebar'].includes(categoryLayout) ||
      !['carousel', 'grid', 'list'].includes(categoryItemsLayout) || !['podium', 'classic'].includes(featuredLayout) ||
      !['grid', 'list'].includes(catalogLayout) || typeof featuredEnabled !== 'boolean' ||
      !validText(featuredTitle, maxFeaturedTitleLength) ||
      !Number.isInteger(featuredLimit) || featuredLimit < 1 || featuredLimit > maxFeaturedLimit ||
      !validIds(featuredIds) || featuredIds.length > maxFeaturedIds ||
      !Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > maxFeaturedLimit ||
      !welcome || !Object.entries(welcomeLimits).every(([key, max]) => validText(welcome[key], max)) ||
      !welcome.siteName.trim() || !welcome.guestButton.trim() || !welcome.adminButton.trim() || !welcome.loginTitle.trim() ||
      !Array.isArray(sizes) || sizes.length > maxPreferenceRows ||
      !sizes.every(row => row && validText(row.label, 60) && row.label.trim() && validText(row.value, 60) && row.value.trim()) ||
      !Array.isArray(favoriteColors) || favoriteColors.length > maxPreferenceRows ||
      !favoriteColors.every(row => row && validText(row.label, 60) && validColor(row.hex)) ||
      typeof avoidEnabled !== 'boolean' || !validText(avoidIntro, 500) ||
      !Array.isArray(avoidGroups) || avoidGroups.length > maxPreferenceRows ||
      !avoidGroups.every(group => group && validText(group.title, 80) && group.title.trim() &&
        validText(group.description, 500) && validText(group.examples, 800)) ||
      typeof rouletteEnabled !== 'boolean') {
    return res.status(400).json({ error: 'Réglages invalides.' });
  }

  const settings = {
    colors: Object.fromEntries(colorKeys.map(key => [key, colors[key]])),
    categoryOrder: [...new Set(categoryOrder)],
    categoryLayout,
    categoryItemsLayout,
    catalogLayout,
    featuredEnabled,
    featuredTitle: featuredTitle.trim() || defaultSettings.featuredTitle,
    featuredLayout,
    featuredLimit,
    featuredIds: [...new Set(featuredIds)],
    recentLimit,
    sizes: sizes.map(({ label, value }) => ({ label: label.trim(), value: value.trim() })),
    favoriteColors: favoriteColors.map(({ label, hex }) => ({ label: label.trim(), hex: hex.toLowerCase() })),
    avoidEnabled,
    avoidIntro: avoidIntro.trim(),
    avoidGroups: avoidGroups.map(({ title, description, examples }) => ({
      title: title.trim(), description: description.trim(), examples: examples.trim()
    })),
    rouletteEnabled,
    welcome: Object.fromEntries(Object.keys(welcomeLimits).map(key => [key, welcome[key].trim()]))
  };
  try {
    await SiteSettings.upsert({ id: 1, settings });
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

export default router;
