import session from 'express-session';
import { db } from './db.js';
import { SqliteSessionStore } from './session-store.js';

export const sessionMiddleware = session({
  store: new SqliteSessionStore(db),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  name: 'sid',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Refresh session on each request
  proxy: true, // Trust the reverse proxy
  cookie: {
    httpOnly: true,
    secure: false, // Set to false for development (localhost)
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
});

export function requireAuth(req, res, next) {
  console.log('Auth check - Session ID:', req.sessionID);
  console.log('Auth check - User ID:', req.session?.userId);
  console.log('Auth check - Session:', req.session);

  if (!req.session || !req.session.userId) {
    console.log('Auth failed - No session or userId');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
