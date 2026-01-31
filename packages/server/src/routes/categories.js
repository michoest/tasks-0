import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcastToSpace } from './sse.js';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

// Middleware to check space membership
function checkSpaceMembership(req, res, next) {
  const spaceId = req.params.spaceId;
  const membership = db.prepare('SELECT * FROM space_members WHERE space_id = ? AND user_id = ?').get(
    spaceId,
    req.session.userId
  );

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this space' });
  }

  req.spaceId = spaceId;
  req.spaceMembership = membership;
  next();
}

router.use(checkSpaceMembership);

// Get all categories for a space
router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT * FROM categories
      WHERE space_id = ?
      ORDER BY position ASC, id ASC
    `).all(req.spaceId);

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new category
router.post('/', (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check uniqueness
    const existing = db.prepare('SELECT * FROM categories WHERE space_id = ? AND name = ?').get(
      req.spaceId,
      name.trim()
    );

    if (existing) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    // Get max position
    const maxPos = db.prepare('SELECT MAX(position) as max FROM categories WHERE space_id = ?').get(req.spaceId);
    const nextPosition = (maxPos?.max !== null ? maxPos.max : -1) + 1;

    // Insert category
    const result = db.prepare(`
      INSERT INTO categories (space_id, name, color, icon, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.spaceId, name.trim(), color || null, icon || null, nextPosition);

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'category_created', category);

    res.json({ category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category
router.patch('/:id', (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, color, icon } = req.body;

    // Check if category exists and belongs to space
    const category = db.prepare('SELECT * FROM categories WHERE id = ? AND space_id = ?').get(
      categoryId,
      req.spaceId
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined && name.trim()) {
      // Check uniqueness (excluding current category)
      const existing = db.prepare('SELECT * FROM categories WHERE space_id = ? AND name = ? AND id != ?').get(
        req.spaceId,
        name.trim(),
        categoryId
      );

      if (existing) {
        return res.status(400).json({ error: 'Category with this name already exists' });
      }

      updates.push('name = ?');
      params.push(name.trim());
    }

    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }

    if (icon !== undefined) {
      updates.push('icon = ?');
      params.push(icon);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(categoryId);

    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updatedCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'category_updated', updatedCategory);

    res.json({ category: updatedCategory });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category
router.delete('/:id', (req, res) => {
  try {
    const categoryId = req.params.id;

    // Check if category exists and belongs to space
    const category = db.prepare('SELECT * FROM categories WHERE id = ? AND space_id = ?').get(
      categoryId,
      req.spaceId
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Delete category (tasks will have category_id set to NULL due to ON DELETE SET NULL)
    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'category_deleted', { id: categoryId });

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder categories
router.post('/reorder', (req, res) => {
  try {
    const { category_ids } = req.body;

    if (!Array.isArray(category_ids) || category_ids.length === 0) {
      return res.status(400).json({ error: 'category_ids must be a non-empty array' });
    }

    // Verify all categories belong to this space
    const placeholders = category_ids.map(() => '?').join(',');
    const categories = db.prepare(`
      SELECT id FROM categories
      WHERE id IN (${placeholders}) AND space_id = ?
    `).all(...category_ids, req.spaceId);

    if (categories.length !== category_ids.length) {
      return res.status(400).json({ error: 'Some categories do not belong to this space' });
    }

    // Update positions
    const stmt = db.prepare('UPDATE categories SET position = ? WHERE id = ?');
    category_ids.forEach((id, index) => {
      stmt.run(index, id);
    });

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'categories_reordered', { category_ids });

    res.json({ ok: true });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
