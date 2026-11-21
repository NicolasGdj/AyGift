import express from 'express';
import categoriesRouter from './routes/categories.js';
import itemsRouter from './routes/items.js';
import itemBooksRouter from './routes/itemBooks.js';
import authRouter from './routes/auth.js';
import configRouter from './routes/config.js';

const router = express.Router();

router.use('/items', itemsRouter);
router.use('/config', configRouter);
router.use(express.json());
router.use('/auth', authRouter);
router.use('/categories', categoriesRouter);
router.use('/bookings', itemBooksRouter);

export default router;
