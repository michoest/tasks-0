/**
 * Recurrence calculation logic for routine tasks
 */

/**
 * Calculate the next due date for a task
 * @param {Object} task - The task object
 * @param {Date} fromDate - The date to calculate from (usually completion date)
 * @returns {string|null} - Next due date in YYYY-MM-DD format, or null for one-time tasks
 */
export function calculateNextDue(task, fromDate = new Date()) {
  // One-time and no-date tasks don't recur
  if (task.recurrence_type === 'one_time' || task.recurrence_type === 'no_date') {
    return null;
  }

  if (task.recurrence_type === 'interval') {
    return calculateIntervalNext(task, fromDate);
  }

  if (task.recurrence_type === 'schedule') {
    return calculateScheduleNext(task, fromDate);
  }

  throw new Error(`Unknown recurrence type: ${task.recurrence_type}`);
}

/**
 * Calculate next due date for interval-based recurrence
 * @param {Object} task - Task with interval_days and interval_exclude_weekends
 * @param {Date} fromDate - Starting date
 * @returns {string} - Next due date in YYYY-MM-DD format
 */
function calculateIntervalNext(task, fromDate) {
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + task.interval_days);

  if (task.interval_exclude_weekends) {
    const day = nextDate.getDay();
    if (day === 0) {
      // Sunday -> Monday
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (day === 6) {
      // Saturday -> Monday
      nextDate.setDate(nextDate.getDate() + 2);
    }
  }

  return nextDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Calculate next due date for schedule-based recurrence
 * @param {Object} task - Task with schedule_pattern (JSON string)
 * @param {Date} fromDate - Starting date
 * @returns {string} - Next due date in YYYY-MM-DD format
 */
function calculateScheduleNext(task, fromDate) {
  const pattern = JSON.parse(task.schedule_pattern);

  if (pattern.type === 'weekly') {
    return calculateWeeklyNext(pattern.weekdays, fromDate);
  }

  if (pattern.type === 'monthly') {
    return calculateMonthlyNext(pattern.days, fromDate);
  }

  throw new Error(`Unknown schedule pattern type: ${pattern.type}`);
}

/**
 * Calculate next occurrence for weekly pattern
 * @param {number[]} weekdays - Array of weekday numbers (0=Sun, 1=Mon, ...)
 * @param {Date} fromDate - Starting date
 * @returns {string} - Next due date in YYYY-MM-DD format
 */
function calculateWeeklyNext(weekdays, fromDate) {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const current = new Date(fromDate);
  current.setDate(current.getDate() + 1); // Start from tomorrow

  // Check next 14 days (2 weeks) to find next matching weekday
  for (let i = 0; i < 14; i++) {
    const day = current.getDay();
    if (sorted.includes(day)) {
      return current.toISOString().split('T')[0];
    }
    current.setDate(current.getDate() + 1);
  }

  throw new Error('Could not find next weekly occurrence');
}

/**
 * Calculate next occurrence for monthly pattern
 * @param {number[]} days - Array of day numbers (1-31)
 * @param {Date} fromDate - Starting date
 * @returns {string} - Next due date in YYYY-MM-DD format
 */
function calculateMonthlyNext(days, fromDate) {
  const sorted = [...days].sort((a, b) => a - b);
  const current = new Date(fromDate);
  const currentDay = current.getDate();

  // Try to find a day later in the current month
  const nextInMonth = sorted.find(d => d > currentDay);
  if (nextInMonth) {
    const testDate = new Date(current.getFullYear(), current.getMonth(), nextInMonth);
    // Check if the date is valid (e.g., Feb 31 would be invalid)
    if (testDate.getDate() === nextInMonth) {
      return testDate.toISOString().split('T')[0];
    }
  }

  // Otherwise, use first day of next month
  current.setMonth(current.getMonth() + 1);

  for (const day of sorted) {
    const testDate = new Date(current.getFullYear(), current.getMonth(), day);
    // Check if the date is valid
    if (testDate.getDate() === day) {
      return testDate.toISOString().split('T')[0];
    }
  }

  throw new Error('Could not find next monthly occurrence');
}

/**
 * Check if a task is overdue
 * @param {Object} task - Task object
 * @returns {boolean} - True if task is overdue
 */
export function isOverdue(task) {
  const now = new Date();

  if (task.has_specific_time) {
    if (!task.next_due_datetime) return false;

    const gracePeriod = task.grace_period_minutes || 120;
    const deadline = new Date(task.next_due_datetime);
    deadline.setMinutes(deadline.getMinutes() + gracePeriod);

    return now > deadline;
  } else {
    if (!task.next_due_date) return false;

    const today = now.toISOString().split('T')[0];
    return task.next_due_date < today;
  }
}

/**
 * Calculate how many days a task is overdue
 * @param {Object} task - Task object
 * @returns {number} - Number of days overdue (0 if not overdue)
 */
export function calculateDaysOverdue(task) {
  if (!isOverdue(task)) return 0;

  const now = new Date();
  const due = new Date(task.next_due_date);

  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/**
 * Calculate how many days until a task is due
 * @param {Object} task - Task object
 * @returns {number|null} - Number of days until due (negative if overdue), or null if no due date
 */
export function calculateDaysUntilDue(task) {
  if (!task.next_due_date) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Start of today

  const due = new Date(task.next_due_date);
  due.setHours(0, 0, 0, 0);

  const diff = Math.floor((due - now) / (1000 * 60 * 60 * 24));
  return diff;
}
