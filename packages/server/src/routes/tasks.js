import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcastToSpace } from './sse.js';
import { calculateNextDue, isOverdue, calculateDaysOverdue, calculateDaysUntilDue } from '../recurrence.js';

const router = Router({ mergeParams: true });

// Stats routes (these don't require spaceId parameter)
const statsRouter = Router();
statsRouter.use(requireAuth);

// Get completions per day for the current user's spaces
statsRouter.get('/completions-per-day', (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = Math.min(parseInt(days) || 30, 365);

    // Get all spaces user is member of
    const userSpaces = db.prepare(`
      SELECT space_id FROM space_members WHERE user_id = ?
    `).all(req.session.userId);

    if (userSpaces.length === 0) {
      return res.json({ stats: [] });
    }

    const spaceIds = userSpaces.map(s => s.space_id);
    const placeholders = spaceIds.map(() => '?').join(',');

    const stats = db.prepare(`
      SELECT
        date(c.completed_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN c.skipped = 0 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN c.skipped = 1 THEN 1 ELSE 0 END) as skipped
      FROM completions c
      JOIN tasks t ON c.task_id = t.id
      WHERE t.space_id IN (${placeholders})
        AND c.completed_at >= date('now', '-' || ? || ' days')
      GROUP BY date(c.completed_at)
      ORDER BY date DESC
    `).all(...spaceIds, daysNum);

    res.json({ stats });
  } catch (error) {
    console.error('Get completions per day error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task occurrences over time
statsRouter.get('/task-occurrences', (req, res) => {
  try {
    const { days = 90 } = req.query;
    const daysNum = Math.min(parseInt(days) || 90, 365);

    // Get all spaces user is member of
    const userSpaces = db.prepare(`
      SELECT space_id FROM space_members WHERE user_id = ?
    `).all(req.session.userId);

    if (userSpaces.length === 0) {
      return res.json({ tasks: [] });
    }

    const spaceIds = userSpaces.map(s => s.space_id);
    const placeholders = spaceIds.map(() => '?').join(',');

    // Get all tasks with their completion history
    const tasks = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.space_id,
        s.name as space_name,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        t.recurrence_type
      FROM tasks t
      JOIN spaces s ON t.space_id = s.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.space_id IN (${placeholders})
        AND t.task_type = 'recurring'
      ORDER BY t.title
    `).all(...spaceIds);

    // Get completions for each task
    const taskOccurrences = tasks.map(task => {
      const completions = db.prepare(`
        SELECT
          date(completed_at) as date,
          skipped
        FROM completions
        WHERE task_id = ?
          AND completed_at >= date('now', '-' || ? || ' days')
        ORDER BY completed_at DESC
      `).all(task.id, daysNum);

      return {
        ...task,
        completions
      };
    });

    res.json({ tasks: taskOccurrences });
  } catch (error) {
    console.error('Get task occurrences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Inbox router for external integrations (e.g., Apple Shortcuts)
const inboxRouter = Router();

// Create inbox item from voice transcript
// This endpoint uses API key authentication for external access
inboxRouter.post('/', (req, res) => {
  try {
    const { transcript, space_id, api_key } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    if (!space_id) {
      return res.status(400).json({ error: 'space_id is required' });
    }

    // Authenticate via API key or session
    let userId;
    if (api_key) {
      // Look up user by API key (stored in users table)
      const user = db.prepare('SELECT id FROM users WHERE api_key = ?').get(api_key);
      if (!user) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      userId = user.id;
    } else if (req.session?.userId) {
      userId = req.session.userId;
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify user is member of space
    const membership = db.prepare('SELECT * FROM space_members WHERE space_id = ? AND user_id = ?').get(space_id, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this space' });
    }

    // Create inbox item with transcript as title (can be edited later)
    // Truncate title to first 100 chars, full transcript stored separately
    const title = transcript.trim().substring(0, 100) + (transcript.length > 100 ? '...' : '');

    const result = db.prepare(`
      INSERT INTO tasks (
        space_id, title, transcript,
        task_type, recurrence_type, status, priority, effort,
        inbox_type, created_by
      ) VALUES (?, ?, ?, 'inbox', 'no_date', 'active', 'medium', 'medium', 'voice', ?)
    `).run(space_id, title, transcript.trim(), userId);

    const task = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    // Broadcast to space
    broadcastToSpace(space_id, 'task_created', task);

    res.json({ task, message: 'Inbox item created successfully' });
  } catch (error) {
    console.error('Create inbox item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { statsRouter, inboxRouter };

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

    // Infer task_type from recurrence_type if not provided
    let taskType = req.body.task_type;
    if (!taskType) {
      if (['one_time', 'no_date'].includes(recurrence_type)) {
        taskType = 'one_time';
      } else if (['interval', 'schedule'].includes(recurrence_type)) {
        taskType = 'recurring';
      } else {
        taskType = 'recurring'; // default
      }
    }

    if (!['recurring', 'one_time', 'inbox'].includes(taskType)) {
      return res.status(400).json({ error: 'Valid task_type is required' });
    }

    // Validate recurrence_type for recurring tasks
    if (taskType === 'recurring' && recurrence_type && !['interval', 'schedule'].includes(recurrence_type)) {
      return res.status(400).json({ error: 'Recurring tasks must use interval or schedule recurrence_type' });
    }

    // next_due_date is not required for inbox tasks or floating one_time tasks
    const isFloating = taskType === 'one_time' && !next_due_date;
    const isInbox = taskType === 'inbox';
    if (!isFloating && !isInbox && !next_due_date) {
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

    // Determine recurrence_type for storage
    // For one_time tasks: use 'one_time' if has due_date, 'no_date' if floating
    // For inbox tasks: use 'no_date' (will be converted when processed)
    // For recurring tasks: use provided recurrence_type
    let finalRecurrenceType = recurrence_type;
    if (taskType === 'one_time') {
      finalRecurrenceType = next_due_date ? 'one_time' : 'no_date';
    } else if (taskType === 'inbox') {
      finalRecurrenceType = 'no_date';
    }

    // Set inbox_type for inbox items
    const inboxType = taskType === 'inbox' ? (req.body.transcript ? 'voice' : 'manual') : null;

    const result = db.prepare(`
      INSERT INTO tasks (
        space_id, category_id, title, description,
        assigned_to, priority, effort,
        task_type, status, recurrence_type,
        interval_days, interval_exclude_weekends, schedule_pattern,
        has_specific_time, time_of_day, grace_period_minutes,
        next_due_date, next_due_datetime,
        transcript, inbox_type, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.spaceId, category_id, title.trim(), description,
      assignedToStr, priority || 'medium', effort || 'medium',
      taskType, 'active', finalRecurrenceType,
      interval_days, interval_exclude_weekends, schedule_pattern,
      has_specific_time ? 1 : 0, time_of_day, grace_period_minutes || 120,
      next_due_date, nextDueDatetime,
      req.body.transcript || null, inboxType, req.session.userId
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
      priority, effort, progress,
      task_type, status,
      recurrence_type, interval_days, interval_exclude_weekends, schedule_pattern,
      has_specific_time, time_of_day, grace_period_minutes,
      next_due_date, transcript
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
    if (progress !== undefined) {
      updates.push('progress = ?');
      params.push(progress);
    }
    if (task_type !== undefined) {
      updates.push('task_type = ?');
      params.push(task_type);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (recurrence_type !== undefined) {
      updates.push('recurrence_type = ?');
      params.push(recurrence_type);
    }
    if (transcript !== undefined) {
      updates.push('transcript = ?');
      params.push(transcript);
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

    // When an inbox item is edited (converted), change its type to one_time
    if (task.task_type === 'inbox' && task_type === undefined) {
      updates.push('task_type = ?');
      params.push('one_time');
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

// Get task stats (7-day history)
router.get('/:id/stats', (req, res) => {
  try {
    const taskId = req.params.id;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND space_id = ?').get(taskId, req.spaceId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get completions for the last 7 days
    const stats = db.prepare(`
      SELECT
        date(completed_at) as date,
        skipped,
        completed_by,
        u.first_name,
        u.last_name
      FROM completions c
      LEFT JOIN users u ON c.completed_by = u.id
      WHERE c.task_id = ?
        AND c.completed_at >= date('now', '-7 days')
      ORDER BY c.completed_at DESC
    `).all(taskId);

    // Calculate summary
    const completed = stats.filter(s => !s.skipped).length;
    const skipped = stats.filter(s => s.skipped).length;

    res.json({
      stats,
      summary: {
        completed,
        skipped,
        total: completed + skipped
      }
    });
  } catch (error) {
    console.error('Get task stats error:', error);
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

    // For one_time and inbox tasks, set status to 'completed' instead of calculating next due
    const isNonRecurring = task.task_type === 'one_time' || task.task_type === 'inbox';
    const newStatus = isNonRecurring ? 'completed' : task.status;
    const finalNextDue = isNonRecurring ? null : nextDue;
    const finalNextDueDatetime = isNonRecurring ? null : nextDueDatetime;

    // Update task
    db.prepare(`
      UPDATE tasks
      SET last_completed_at = ?,
          last_completed_by = ?,
          next_due_date = ?,
          next_due_datetime = ?,
          status = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      now.toISOString(), req.session.userId,
      finalNextDue, finalNextDueDatetime,
      newStatus,
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
