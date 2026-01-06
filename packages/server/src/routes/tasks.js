import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcastToSpace } from './sse.js';
import { calculateNextDue, isOverdue, calculateDaysOverdue, calculateDaysUntilDue } from '../recurrence.js';

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

// Helper function to enrich task with computed fields
function enrichTask(task) {
  return {
    ...task,
    category: task.category_id ? {
      id: task.category_id,
      name: task.category_name,
      color: task.category_color,
      icon: task.category_icon
    } : null,
    assigned_to: task.assigned_to ? task.assigned_to.split(',').map(Number) : [],
    is_overdue: isOverdue(task),
    days_until_due: calculateDaysUntilDue(task),
    days_overdue: calculateDaysOverdue(task)
  };
}

// Get all tasks for a space
router.get('/', (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        u1.email as created_by_email,
        u2.email as last_completed_by_email
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.last_completed_by = u2.id
      WHERE t.space_id = ?
      ORDER BY t.next_due_date ASC
    `).all(req.spaceId);

    const enriched = tasks.map(enrichTask);

    res.json({ tasks: enriched });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new task
router.post('/', (req, res) => {
  try {
    const {
      title, description, category_id, assigned_to,
      priority, effort,
      recurrence_type, interval_days, interval_exclude_weekends, schedule_pattern,
      has_specific_time, time_of_day, grace_period_minutes,
      next_due_date
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!recurrence_type || !['one_time', 'interval', 'schedule', 'inactive', 'no_date'].includes(recurrence_type)) {
      return res.status(400).json({ error: 'Valid recurrence_type is required' });
    }

    // next_due_date is not required for inactive tasks or no_date tasks
    if (!['inactive', 'no_date'].includes(recurrence_type) && !next_due_date) {
      return res.status(400).json({ error: 'next_due_date is required' });
    }

    // Convert assigned_to array to comma-separated string
    const assignedToStr = assigned_to && assigned_to.length > 0
      ? assigned_to.join(',')
      : null;

    // Calculate next_due_datetime if has_specific_time
    let nextDueDatetime = null;
    if (has_specific_time && time_of_day) {
      nextDueDatetime = `${next_due_date}T${time_of_day}:00`;
    }

    const result = db.prepare(`
      INSERT INTO tasks (
        space_id, category_id, title, description,
        assigned_to, priority, effort,
        recurrence_type, interval_days, interval_exclude_weekends, schedule_pattern,
        has_specific_time, time_of_day, grace_period_minutes,
        next_due_date, next_due_datetime,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.spaceId, category_id, title.trim(), description,
      assignedToStr, priority || 'medium', effort || 'medium',
      recurrence_type, interval_days, interval_exclude_weekends, schedule_pattern,
      has_specific_time ? 1 : 0, time_of_day, grace_period_minutes || 120,
      next_due_date, nextDueDatetime,
      req.session.userId
    );

    const task = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    const enriched = enrichTask(task);

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'task_created', enriched);

    res.json({ task: enriched });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.patch('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const {
      title, description, category_id, assigned_to,
      priority, effort,
      recurrence_type, interval_days, interval_exclude_weekends, schedule_pattern,
      has_specific_time, time_of_day, grace_period_minutes,
      next_due_date
    } = req.body;

    // Check if task exists and belongs to space
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND space_id = ?').get(taskId, req.spaceId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (category_id !== undefined) {
      updates.push('category_id = ?');
      params.push(category_id);
    }
    if (assigned_to !== undefined) {
      const assignedToStr = assigned_to && assigned_to.length > 0 ? assigned_to.join(',') : null;
      updates.push('assigned_to = ?');
      params.push(assignedToStr);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (effort !== undefined) {
      updates.push('effort = ?');
      params.push(effort);
    }
    if (recurrence_type !== undefined) {
      updates.push('recurrence_type = ?');
      params.push(recurrence_type);
    }
    if (interval_days !== undefined) {
      updates.push('interval_days = ?');
      params.push(interval_days);
    }
    if (interval_exclude_weekends !== undefined) {
      updates.push('interval_exclude_weekends = ?');
      params.push(interval_exclude_weekends ? 1 : 0);
    }
    if (schedule_pattern !== undefined) {
      updates.push('schedule_pattern = ?');
      params.push(schedule_pattern);
    }
    if (has_specific_time !== undefined) {
      updates.push('has_specific_time = ?');
      params.push(has_specific_time ? 1 : 0);
    }
    if (time_of_day !== undefined) {
      updates.push('time_of_day = ?');
      params.push(time_of_day);
    }
    if (grace_period_minutes !== undefined) {
      updates.push('grace_period_minutes = ?');
      params.push(grace_period_minutes);
    }
    if (next_due_date !== undefined) {
      updates.push('next_due_date = ?');
      params.push(next_due_date);

      // Recalculate next_due_datetime if needed
      if (task.has_specific_time && task.time_of_day) {
        updates.push('next_due_datetime = ?');
        params.push(`${next_due_date}T${task.time_of_day}:00`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(taskId);

    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updatedTask = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(taskId);

    const enriched = enrichTask(updatedTask);

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'task_updated', enriched);

    res.json({ task: enriched });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task
router.delete('/:id', (req, res) => {
  try {
    const taskId = req.params.id;

    // Check if task exists and belongs to space
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND space_id = ?').get(taskId, req.spaceId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'task_deleted', { id: taskId });

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete task
router.post('/:id/complete', (req, res) => {
  try {
    const taskId = req.params.id;
    const { notes, photo_urls, links } = req.body;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND space_id = ?').get(taskId, req.spaceId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const now = new Date();
    const wasOverdue = isOverdue(task);
    const daysOverdue = calculateDaysOverdue(task);

    // Create completion record
    db.prepare(`
      INSERT INTO completions (
        task_id, completed_by, completed_at,
        was_overdue, days_overdue,
        notes, photo_urls, links, skipped
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      taskId, req.session.userId, now.toISOString(),
      wasOverdue ? 1 : 0, daysOverdue,
      notes, JSON.stringify(photo_urls || []), JSON.stringify(links || [])
    );

    // Calculate next due date
    const nextDue = calculateNextDue(task, now);

    let nextDueDatetime = null;
    if (task.has_specific_time && nextDue && task.time_of_day) {
      nextDueDatetime = `${nextDue}T${task.time_of_day}:00`;
    }

    // Update task
    db.prepare(`
      UPDATE tasks
      SET last_completed_at = ?,
          last_completed_by = ?,
          next_due_date = ?,
          next_due_datetime = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      now.toISOString(), req.session.userId,
      nextDue, nextDueDatetime,
      now.toISOString(), taskId
    );

    const updatedTask = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(taskId);

    const enriched = enrichTask(updatedTask);

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'task_completed', enriched);

    res.json({ task: enriched, next_due_date: nextDue });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Skip task
router.post('/:id/skip', (req, res) => {
  try {
    const taskId = req.params.id;
    const { notes } = req.body;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND space_id = ?').get(taskId, req.spaceId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const now = new Date();

    // Create skip record
    db.prepare(`
      INSERT INTO completions (
        task_id, completed_by, completed_at,
        notes, skipped
      ) VALUES (?, ?, ?, ?, 1)
    `).run(taskId, req.session.userId, now.toISOString(), notes);

    // Calculate next due (same as complete, but don't update last_completed_at)
    const nextDue = calculateNextDue(task, now);

    let nextDueDatetime = null;
    if (task.has_specific_time && nextDue && task.time_of_day) {
      nextDueDatetime = `${nextDue}T${task.time_of_day}:00`;
    }

    db.prepare(`
      UPDATE tasks
      SET next_due_date = ?,
          next_due_datetime = ?,
          updated_at = ?
      WHERE id = ?
    `).run(nextDue, nextDueDatetime, now.toISOString(), taskId);

    const updatedTask = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(taskId);

    const enriched = enrichTask(updatedTask);

    // Broadcast to space (silent, no notification to other users)
    broadcastToSpace(req.spaceId, 'task_skipped', enriched);

    res.json({ task: enriched, next_due_date: nextDue });
  } catch (error) {
    console.error('Skip task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Postpone task - move to a new date
router.post('/:id/postpone', (req, res) => {
  try {
    const taskId = req.params.id;
    const { new_date, days } = req.body;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND space_id = ?').get(taskId, req.spaceId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only allow postponing tasks with dates
    if (['inactive', 'no_date'].includes(task.recurrence_type)) {
      return res.status(400).json({ error: 'Cannot postpone tasks without dates' });
    }

    // Calculate new due date
    let nextDue;
    if (new_date) {
      // Use the provided date directly
      nextDue = new_date;
    } else if (days) {
      // Add days to current next_due_date
      const currentDue = task.next_due_date ? new Date(task.next_due_date) : new Date();
      currentDue.setDate(currentDue.getDate() + days);
      nextDue = currentDue.toISOString().split('T')[0];
    } else {
      return res.status(400).json({ error: 'Either new_date or days is required' });
    }

    // Calculate next_due_datetime if task has specific time
    let nextDueDatetime = null;
    if (task.has_specific_time && task.time_of_day) {
      nextDueDatetime = `${nextDue}T${task.time_of_day}:00`;
    }

    const now = new Date();

    db.prepare(`
      UPDATE tasks
      SET next_due_date = ?,
          next_due_datetime = ?,
          updated_at = ?
      WHERE id = ?
    `).run(nextDue, nextDueDatetime, now.toISOString(), taskId);

    const updatedTask = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(taskId);

    const enriched = enrichTask(updatedTask);

    // Broadcast to space
    broadcastToSpace(req.spaceId, 'task_postponed', enriched);

    res.json({ task: enriched, next_due_date: nextDue });
  } catch (error) {
    console.error('Postpone task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
