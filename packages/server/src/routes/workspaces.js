import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get all workspaces for current user
router.get('/', (req, res) => {
  try {
    const workspaces = db.prepare(`
      SELECT w.*, wm.role
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = ?
      ORDER BY w.created_at DESC
    `).all(req.session.userId);

    res.json({ workspaces });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new workspace
router.post('/', (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const inviteCode = nanoid(10);
    const result = db.prepare('INSERT INTO workspaces (name, owner_id, invite_code) VALUES (?, ?, ?)').run(
      name.trim(),
      req.session.userId,
      inviteCode
    );

    const workspaceId = result.lastInsertRowid;

    // Add creator as owner
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(
      workspaceId,
      req.session.userId,
      'owner'
    );

    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);

    res.json({ workspace });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace by ID with members
router.get('/:id', (req, res) => {
  try {
    const workspaceId = req.params.id;

    // Check membership
    const membership = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(
      workspaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);

    const members = db.prepare(`
      SELECT u.id, u.email, wm.role, wm.joined_at
      FROM users u
      JOIN workspace_members wm ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
    `).all(workspaceId);

    res.json({ workspace, members });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update workspace
router.patch('/:id', (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    // Check if user is owner
    const membership = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(
      workspaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    if (membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can update the workspace' });
    }

    db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name.trim(), workspaceId);

    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);

    res.json({ workspace });
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete workspace
router.delete('/:id', (req, res) => {
  try {
    const workspaceId = req.params.id;

    // Check if user is owner
    const membership = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(
      workspaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    if (membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can delete the workspace' });
    }

    db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join workspace via invite code
router.post('/join', (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const workspace = db.prepare('SELECT * FROM workspaces WHERE invite_code = ?').get(inviteCode);

    if (!workspace) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // Check if already a member
    const existing = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(
      workspace.id,
      req.session.userId
    );

    if (existing) {
      return res.status(400).json({ error: 'Already a member of this workspace' });
    }

    // Add as member
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(
      workspace.id,
      req.session.userId,
      'member'
    );

    res.json({ workspace });
  } catch (error) {
    console.error('Join workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave workspace
router.post('/:id/leave', (req, res) => {
  try {
    const workspaceId = req.params.id;

    // Check membership
    const membership = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(
      workspaceId,
      req.session.userId
    );

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    if (membership.role === 'owner') {
      return res.status(400).json({ error: 'Owner cannot leave workspace. Delete it instead or transfer ownership first.' });
    }

    db.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?').run(
      workspaceId,
      req.session.userId
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Leave workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
