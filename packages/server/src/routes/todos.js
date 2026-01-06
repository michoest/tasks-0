import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { notifyWorkspaceMembers } from '../push.js';
import { broadcastToSpace } from './sse.js';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

// Middleware to check workspace membership
function checkWorkspaceMembership(req, res, next) {
  const workspaceId = req.params.workspaceId;
  const membership = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(
    workspaceId,
    req.session.userId
  );

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this workspace' });
  }

  req.workspaceId = workspaceId;
  next();
}

router.use(checkWorkspaceMembership);

// Get all todos for workspace
router.get('/', (req, res) => {
  try {
    const todos = db.prepare(`
      SELECT t.*,
        u1.email as created_by_email,
        u2.email as completed_by_email
      FROM todos t
      LEFT JOIN users u1 ON u1.id = t.created_by
      LEFT JOIN users u2 ON u2.id = t.completed_by
      WHERE t.workspace_id = ?
      ORDER BY t.completed ASC, t.created_at DESC
    `).all(req.workspaceId);

    res.json({ todos });
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new todo
router.post('/', (req, res) => {
  try {
    const { title, dueAt } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Todo title is required' });
    }

    // Validate dueAt if provided
    if (dueAt && isNaN(Date.parse(dueAt))) {
      return res.status(400).json({ error: 'Invalid due date format' });
    }

    const result = db.prepare(`
      INSERT INTO todos (workspace_id, title, created_by, due_at)
      VALUES (?, ?, ?, ?)
    `).run(req.workspaceId, title.trim(), req.session.userId, dueAt || null);

    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);

    // Broadcast new todo to all workspace members
    broadcastToSpace(req.workspaceId, 'todo_created', todo);

    // Send push notification
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId);
    notifyWorkspaceMembers(req.workspaceId, {
      title: '✓ Neue Aufgabe',
      body: `${todo.title} wurde von ${user.email} erstellt`,
      data: { workspaceId: req.workspaceId, todoId: todo.id }
    }, req.session.userId);

    res.json({ todo });
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update todo
router.patch('/:id', (req, res) => {
  try {
    const todoId = req.params.id;
    const { title, dueAt, completed } = req.body;

    // Check if todo exists and belongs to this workspace
    const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND workspace_id = ?').get(todoId, req.workspaceId);

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: 'Todo title cannot be empty' });
      }
      updates.push('title = ?');
      values.push(title.trim());
    }

    if (dueAt !== undefined) {
      if (dueAt && isNaN(Date.parse(dueAt))) {
        return res.status(400).json({ error: 'Invalid due date format' });
      }
      updates.push('due_at = ?');
      values.push(dueAt || null);
    }

    if (completed !== undefined) {
      const wasCompleted = todo.completed;
      const isNowCompleted = completed ? 1 : 0;

      updates.push('completed = ?');
      values.push(isNowCompleted);

      if (isNowCompleted && !wasCompleted) {
        updates.push('completed_by = ?');
        values.push(req.session.userId);

        // Send notification to other workspace members
        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId);
        notifyWorkspaceMembers(req.workspaceId, {
          title: '✓ Aufgabe erledigt',
          body: `${todo.title} wurde von ${user.email} abgeschlossen`,
          data: { workspaceId: req.workspaceId, todoId }
        }, req.session.userId);
      } else if (!isNowCompleted && wasCompleted) {
        updates.push('completed_by = ?');
        values.push(null);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(todoId);

    db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedTodo = db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId);

    // Broadcast todo update to all workspace members
    broadcastToSpace(req.workspaceId, 'todo_updated', updatedTodo);

    res.json({ todo: updatedTodo });
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete todo
router.delete('/:id', (req, res) => {
  try {
    const todoId = parseInt(req.params.id, 10);

    // Check if todo exists and belongs to this workspace
    const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND workspace_id = ?').get(todoId, req.workspaceId);

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    db.prepare('DELETE FROM todos WHERE id = ?').run(todoId);

    // Broadcast todo deletion to all workspace members
    console.log(`Deleting todo ${todoId}, broadcasting to workspace ${req.workspaceId}`);
    broadcastToSpace(req.workspaceId, 'todo_deleted', { id: todoId });

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
