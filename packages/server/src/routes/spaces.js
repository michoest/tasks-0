import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get all spaces for current user
router.get('/', (req, res) => {
  try {
    const spaces = db.prepare(`
      SELECT s.*, sm.role, sm.personal_name, sm.personal_color, sm.position
      FROM spaces s
      JOIN space_members sm ON sm.space_id = s.id
      WHERE sm.user_id = ?
      ORDER BY sm.position ASC, s.created_at DESC
    `).all(req.session.userId);

    res.json({ spaces });
  } catch (error) {
    console.error('Get spaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new space
router.post('/', (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Space name is required' });
    }

    const inviteCode = nanoid(10);
    const result = db.prepare('INSERT INTO spaces (name, owner_id, invite_code) VALUES (?, ?, ?)').run(
      name.trim(),
      req.session.userId,
      inviteCode
    );

    const spaceId = result.lastInsertRowid;

    // Add creator as owner
    db.prepare('INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)').run(
      spaceId,
      req.session.userId,
      'owner'
    );

    const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(spaceId);

    res.json({ space });
  } catch (error) {
    console.error('Create space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get space by ID with members
router.get('/:id', (req, res) => {
  try {
    const spaceId = req.params.id;

    // Check membership and get personal settings
    const membership = db.prepare('SELECT * FROM space_members WHERE space_id = ? AND user_id = ?').get(
      spaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this space' });
    }

    const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(spaceId);

    // Add user's role and personal settings to space object
    space.role = membership.role;
    space.personal_name = membership.personal_name;
    space.personal_color = membership.personal_color;

    const members = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, sm.role, sm.joined_at
      FROM users u
      JOIN space_members sm ON sm.user_id = u.id
      WHERE sm.space_id = ?
      ORDER BY sm.role DESC, sm.joined_at ASC
    `).all(spaceId);

    res.json({ space, members });
  } catch (error) {
    console.error('Get space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update space
router.patch('/:id', (req, res) => {
  try {
    const spaceId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Space name is required' });
    }

    // Check if user is owner
    const membership = db.prepare('SELECT role FROM space_members WHERE space_id = ? AND user_id = ?').get(
      spaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this space' });
    }

    if (membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can update the space' });
    }

    db.prepare('UPDATE spaces SET name = ? WHERE id = ?').run(name.trim(), spaceId);

    const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(spaceId);

    res.json({ space });
  } catch (error) {
    console.error('Update space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete space
router.delete('/:id', (req, res) => {
  try {
    const spaceId = req.params.id;

    // Check if user is owner
    const membership = db.prepare('SELECT role FROM space_members WHERE space_id = ? AND user_id = ?').get(
      spaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this space' });
    }

    if (membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can delete the space' });
    }

    db.prepare('DELETE FROM spaces WHERE id = ?').run(spaceId);

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join space via invite code
router.post('/join', (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const space = db.prepare('SELECT * FROM spaces WHERE invite_code = ?').get(inviteCode);

    if (!space) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // Check if already a member
    const existing = db.prepare('SELECT * FROM space_members WHERE space_id = ? AND user_id = ?').get(
      space.id,
      req.session.userId
    );

    if (existing) {
      return res.status(400).json({ error: 'Already a member of this space' });
    }

    // Add as member
    db.prepare('INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)').run(
      space.id,
      req.session.userId,
      'member'
    );

    res.json({ space });
  } catch (error) {
    console.error('Join space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave space
router.post('/:id/leave', (req, res) => {
  try {
    const spaceId = req.params.id;

    // Check membership
    const membership = db.prepare('SELECT role FROM space_members WHERE space_id = ? AND user_id = ?').get(
      spaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this space' });
    }

    if (membership.role === 'owner') {
      return res.status(400).json({ error: 'Owner cannot leave space. Delete it instead or transfer ownership first.' });
    }

    db.prepare('DELETE FROM space_members WHERE space_id = ? AND user_id = ?').run(
      spaceId,
      req.session.userId
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Leave space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update personal settings for a space
router.patch('/:id/personal-settings', (req, res) => {
  try {
    const spaceId = req.params.id;
    const { personal_name, personal_color } = req.body;

    // Check membership
    const membership = db.prepare('SELECT * FROM space_members WHERE space_id = ? AND user_id = ?').get(
      spaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this space' });
    }

    db.prepare(`
      UPDATE space_members
      SET personal_name = ?, personal_color = ?
      WHERE space_id = ? AND user_id = ?
    `).run(personal_name, personal_color, spaceId, req.session.userId);

    res.json({ ok: true });
  } catch (error) {
    console.error('Update personal settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder spaces for current user
router.post('/reorder', (req, res) => {
  try {
    const { space_ids } = req.body;

    if (!Array.isArray(space_ids) || space_ids.length === 0) {
      return res.status(400).json({ error: 'space_ids must be a non-empty array' });
    }

    // Verify all spaces belong to this user
    const placeholders = space_ids.map(() => '?').join(',');
    const memberships = db.prepare(`
      SELECT space_id FROM space_members
      WHERE space_id IN (${placeholders}) AND user_id = ?
    `).all(...space_ids, req.session.userId);

    if (memberships.length !== space_ids.length) {
      return res.status(400).json({ error: 'Some spaces do not belong to this user' });
    }

    // Update positions
    const stmt = db.prepare('UPDATE space_members SET position = ? WHERE space_id = ? AND user_id = ?');
    space_ids.forEach((id, index) => {
      stmt.run(index, id, req.session.userId);
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Reorder spaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
