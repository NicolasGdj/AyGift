import express from 'express';
import categoriesRouter from './routes/categories.js';
import itemsRouter from './routes/items.js';
import itemBooksRouter from './routes/itemBooks.js';
import authRouter from './routes/auth.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/categories', categoriesRouter);
router.use('/items', itemsRouter);
router.use('/bookings', itemBooksRouter);

export default router;
