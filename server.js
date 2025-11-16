import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './api.js';
import { syncDatabase } from './dao/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRouter);

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Root route returning index.html (already handled by static middleware)
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
syncDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Express server started at http://localhost:${PORT}`);
  });
});
