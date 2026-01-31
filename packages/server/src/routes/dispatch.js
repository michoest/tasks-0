import { Router } from 'express';
import { db } from '../db.js';
import { broadcastToSpace } from './sse.js';

const router = Router();

// Dispatch API key authentication middleware
function requireDispatchApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.DISPATCH_API_KEY;

  if (!expectedKey) {
    console.error('DISPATCH_API_KEY not configured');
    return res.status(500).json({ success: false, error: 'Dispatch API key not configured' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ success: false, error: 'Invalid or missing API key' });
  }

  next();
}

// Health check - no authentication required
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tasks'
  });
});

// Service documentation - API key required
router.get('/docs', requireDispatchApiKey, (req, res) => {
  res.json({
    service: 'tasks',
    description: 'Task management service with inbox, categories, and recurring tasks',
    endpoints: [
      {
        method: 'POST',
        path: '/dispatch/inbox/add',
        description: 'Add a new item to the inbox for later processing',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The title or content of the inbox item (extracted from voice command)'
            },
            space_name: {
              type: 'string',
              description: 'Optional: Name of the space to add the task to. If not provided, uses the default space.'
            }
          },
          required: ['title']
        }
      }
    ]
  });
});

// Add to inbox - API key required
router.post('/inbox/add', requireDispatchApiKey, (req, res) => {
  try {
    const { title, space_name } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    // Get the user associated with the dispatch API key
    // For now, we'll use the first user in the system (admin)
    // In a full implementation, you might want to associate the API key with a specific user
    const user = db.prepare('SELECT id FROM users LIMIT 1').get();
    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'No users found in the system'
      });
    }

    // Find the space - either by name or use the first available space
    let space;
    if (space_name) {
      // Try to find space by name (case-insensitive partial match)
      space = db.prepare(`
        SELECT s.id, s.name FROM spaces s
        JOIN space_members sm ON s.id = sm.space_id
        WHERE sm.user_id = ? AND LOWER(s.name) LIKE LOWER(?)
        LIMIT 1
      `).get(user.id, `%${space_name}%`);

      if (!space) {
        // Also try matching personal_name in space_members
        const membership = db.prepare(`
          SELECT s.id, COALESCE(sm.personal_name, s.name) as name
          FROM spaces s
          JOIN space_members sm ON s.id = sm.space_id
          WHERE sm.user_id = ? AND (LOWER(s.name) LIKE LOWER(?) OR LOWER(sm.personal_name) LIKE LOWER(?))
          LIMIT 1
        `).get(user.id, `%${space_name}%`, `%${space_name}%`);

        if (membership) {
          space = { id: membership.id, name: membership.name };
        }
      }
    }

    // If no space found by name, use the first available space
    if (!space) {
      space = db.prepare(`
        SELECT s.id, s.name FROM spaces s
        JOIN space_members sm ON s.id = sm.space_id
        WHERE sm.user_id = ?
        ORDER BY sm.position ASC, s.id ASC
        LIMIT 1
      `).get(user.id);
    }

    if (!space) {
      return res.status(400).json({
        success: false,
        error: 'No spaces available for this user'
      });
    }

    // Create the inbox item
    const result = db.prepare(`
      INSERT INTO tasks (
        space_id, title,
        task_type, recurrence_type, status, priority, effort,
        inbox_type, created_by
      ) VALUES (?, ?, 'inbox', 'no_date', 'active', 'medium', 'medium', 'voice', ?)
    `).run(space.id, title.trim(), user.id);

    const task = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    // Broadcast to space
    broadcastToSpace(space.id, 'task_created', task);

    // Build the URL to the dashboard (where inbox items are shown)
    const baseUrl = process.env.BASE_URL || process.env.CLIENT_URL || 'https://localhost:5173';
    const url = `${baseUrl}/dashboard`;

    res.json({
      success: true,
      message: `Added "${title.trim()}" to inbox`,
      url,
      data: {
        id: task.id,
        title: task.title,
        space_id: space.id,
        space_name: space.name
      }
    });
  } catch (error) {
    console.error('Dispatch inbox add error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
