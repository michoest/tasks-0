import cron from 'node-cron';
import { db } from './db.js';
import { notifyUser } from './push.js';

// Run every minute to check for due reminders
export function startScheduler() {
  cron.schedule('* * * * *', () => {
    const now = new Date().toISOString();

    const dueTodos = db.prepare(`
      SELECT t.*, u.email as creator_email
      FROM todos t
      JOIN users u ON u.id = t.created_by
      WHERE t.due_at <= ? AND t.reminder_sent = 0 AND t.completed = 0
    `).all(now);

    for (const todo of dueTodos) {
      notifyUser(todo.created_by, {
        title: '⏰ Erinnerung',
        body: todo.title,
        data: { workspaceId: todo.workspace_id, todoId: todo.id }
      });

      db.prepare('UPDATE todos SET reminder_sent = 1 WHERE id = ?').run(todo.id);
      console.log(`📬 Sent reminder for todo: ${todo.title}`);
    }
  });

  console.log('⏰ Reminder scheduler started');
}
