import 'dotenv/config';
import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { sessionMiddleware } from './auth.js';
import { startScheduler } from './scheduler.js';
import authRoutes from './routes/auth.js';
import spacesRoutes from './routes/spaces.js';
import usersRoutes from './routes/users.js';
import categoriesRoutes from './routes/categories.js';
import tasksRoutes, { statsRouter } from './routes/tasks.js';
import pushRoutes from './routes/push.js';
import sseRoutes from './routes/sse.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : true, // Allow all origins in development for local network access
  credentials: true
}));

app.use(express.json());
app.use(sessionMiddleware);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  console.log('Cookies:', req.headers.cookie);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/spaces/:spaceId/categories', categoriesRoutes);
app.use('/api/spaces/:spaceId/tasks', tasksRoutes);
app.use('/api/stats', statsRouter);
app.use('/api/push', pushRoutes);
app.use('/api/sse', sseRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server (HTTPS in dev, HTTP in production with platform-provided HTTPS)
if (process.env.NODE_ENV === 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📝 API available at http://0.0.0.0:${PORT}/api`);
    startScheduler();
  });
} else {
  const httpsOptions = {
    key: fs.readFileSync('../../certs/key.pem'),
    cert: fs.readFileSync('../../certs/cert.pem')
  };

  https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on https://0.0.0.0:${PORT}`);
    console.log(`📝 API available at https://0.0.0.0:${PORT}/api`);
    console.log(`📱 Access from other devices on your network`);
    startScheduler();
  });
}
