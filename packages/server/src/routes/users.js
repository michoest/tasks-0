import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Update user settings
router.patch('/settings', (req, res) => {
  try {
    const { notification_time, digest_filter, first_name, last_name } = req.body;

    // Validation
    if (notification_time && !/^\d{2}:\d{2}$/.test(notification_time)) {
      return res.status(400).json({ error: 'Invalid time format. Expected HH:MM' });
    }

    const validFilters = ['overdue_and_today', 'today_only', 'next_7_days', 'all'];
    if (digest_filter && !validFilters.includes(digest_filter)) {
      return res.status(400).json({ error: `Invalid digest filter. Must be one of: ${validFilters.join(', ')}` });
    }

    // Update only provided fields
    const updates = [];
    const params = [];

    if (notification_time) {
      updates.push('notification_time = ?');
      params.push(notification_time);
    }

    if (digest_filter) {
      updates.push('digest_filter = ?');
      params.push(digest_filter);
    }

    if (first_name !== undefined) {
      updates.push('first_name = ?');
      params.push(first_name || null);
    }

    if (last_name !== undefined) {
      updates.push('last_name = ?');
      params.push(last_name || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No settings provided to update' });
    }

    params.push(req.session.userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db.prepare('SELECT id, email, first_name, last_name, notification_time, digest_filter FROM users WHERE id = ?')
      .get(req.session.userId);

    res.json({ user });
  } catch (error) {
    console.error('Update user settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
