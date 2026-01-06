import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../data/routines.db');

// Ensure data directory exists
const dataDir = dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations
function migrate() {
  const version = db.pragma('user_version', { simple: true });

  if (version === 0) {
    console.log('Running database migrations for Routines app...');

    db.exec(`
      -- Users
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        notification_time TEXT DEFAULT '08:00',
        digest_filter TEXT DEFAULT 'overdue_and_today',
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Spaces (renamed from workspaces)
      CREATE TABLE spaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Space membership (many-to-many)
      CREATE TABLE space_members (
        space_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (space_id, user_id),
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Categories (per space, customizable)
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        space_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        position INTEGER DEFAULT 0,
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
        UNIQUE(space_id, name)
      );

      -- Tasks (renamed from todos, with recurrence)
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        space_id INTEGER NOT NULL,
        category_id INTEGER,

        -- Basic info
        title TEXT NOT NULL,
        description TEXT,

        -- Assignment
        assigned_to TEXT,

        -- Priority & Effort
        priority TEXT DEFAULT 'medium',
        effort TEXT DEFAULT 'medium',

        -- Recurrence pattern
        recurrence_type TEXT NOT NULL,
        interval_days INTEGER,
        interval_exclude_weekends INTEGER DEFAULT 0,
        schedule_pattern TEXT,

        -- Time control
        has_specific_time INTEGER DEFAULT 0,
        time_of_day TEXT,
        grace_period_minutes INTEGER DEFAULT 120,

        -- Next due (calculated)
        next_due_date TEXT,
        next_due_datetime TEXT,

        -- Last completion
        last_completed_at TEXT,
        last_completed_by INTEGER,

        -- Metadata
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),

        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (last_completed_by) REFERENCES users(id)
      );

      -- Completions (history of task completions)
      CREATE TABLE completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,

        -- Who & When
        completed_by INTEGER NOT NULL,
        completed_at TEXT DEFAULT (datetime('now')),

        -- Was it overdue?
        was_overdue INTEGER DEFAULT 0,
        days_overdue INTEGER DEFAULT 0,

        -- Additional info (optional)
        notes TEXT,
        photo_urls TEXT,
        links TEXT,

        -- Skipped instead of completed?
        skipped INTEGER DEFAULT 0,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (completed_by) REFERENCES users(id)
      );

      -- Notifications tracking
      CREATE TABLE notifications_sent (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        user_id INTEGER NOT NULL,
        notification_type TEXT NOT NULL,
        sent_at TEXT DEFAULT (datetime('now')),
        for_due_date TEXT,
        for_due_datetime TEXT,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Push subscriptions (per user, per device)
      CREATE TABLE push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT UNIQUE NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Sessions table (managed by better-sqlite3-session-store)
      CREATE TABLE sessions (
        sid TEXT PRIMARY KEY,
        expire INTEGER NOT NULL,
        sess TEXT NOT NULL
      );

      -- Indexes
      CREATE INDEX idx_categories_space ON categories(space_id);
      CREATE INDEX idx_tasks_space ON tasks(space_id);
      CREATE INDEX idx_tasks_next_due_date ON tasks(next_due_date) WHERE next_due_date IS NOT NULL;
      CREATE INDEX idx_tasks_next_due_datetime ON tasks(next_due_datetime) WHERE next_due_datetime IS NOT NULL;
      CREATE INDEX idx_completions_task ON completions(task_id);
      CREATE INDEX idx_completions_user ON completions(completed_by);
      CREATE INDEX idx_completions_date ON completions(completed_at);
      CREATE INDEX idx_notifications_task_user ON notifications_sent(task_id, user_id);
      CREATE INDEX idx_notifications_sent_at ON notifications_sent(sent_at);
      CREATE INDEX idx_push_user ON push_subscriptions(user_id);
      CREATE INDEX idx_sessions_expire ON sessions(expire);
    `);

    db.pragma('user_version = 1');
    console.log('Database migrations completed.');
  }

  if (version < 2) {
    console.log('Running migration v2: Adding personal settings and space ordering...');

    db.exec(`
      -- Add personal settings columns to space_members
      ALTER TABLE space_members ADD COLUMN personal_name TEXT;
      ALTER TABLE space_members ADD COLUMN personal_color TEXT;
      ALTER TABLE space_members ADD COLUMN position INTEGER DEFAULT 0;
    `);

    db.pragma('user_version = 2');
    console.log('Migration v2 completed.');
  }

  if (version < 3) {
    console.log('Running migration v3: Adding first_name and last_name to users...');

    db.exec(`
      -- Add name columns to users
      ALTER TABLE users ADD COLUMN first_name TEXT;
      ALTER TABLE users ADD COLUMN last_name TEXT;
    `);

    db.pragma('user_version = 3');
    console.log('Migration v3 completed.');
  }
}

// Seed initial data
function seed() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  if (userCount === 0) {
    console.log('Seeding database with initial data...');

    // Create admin user
    const passwordHash = bcrypt.hashSync('admin', 10);
    const insertUser = db.prepare('INSERT INTO users (email, password_hash, notification_time, digest_filter) VALUES (?, ?, ?, ?)');
    const adminResult = insertUser.run('mail@michoest.com', passwordHash, '08:00', 'overdue_and_today');
    const adminId = adminResult.lastInsertRowid;

    // Create sample space
    const insertSpace = db.prepare('INSERT INTO spaces (name, owner_id, invite_code) VALUES (?, ?, ?)');
    const insertMember = db.prepare('INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)');

    const space = insertSpace.run('Haushalt', adminId, nanoid(10));
    const spaceId = space.lastInsertRowid;
    insertMember.run(spaceId, adminId, 'owner');

    // Default categories for this space
    const defaultCategories = ['Haushalt', 'Kinder', 'Finanzen', 'Garten', 'Pflege'];
    const defaultColors = ['#FF5722', '#4CAF50', '#2196F3', '#8BC34A', '#9C27B0'];
    const defaultIcons = ['mdi-home', 'mdi-baby-face', 'mdi-currency-eur', 'mdi-flower', 'mdi-hospital-box'];

    const insertCategory = db.prepare('INSERT INTO categories (space_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?)');
    defaultCategories.forEach((name, i) => {
      insertCategory.run(spaceId, name, defaultColors[i], defaultIcons[i], i);
    });

    // Get category IDs
    const haushaltCat = db.prepare('SELECT id FROM categories WHERE space_id = ? AND name = ?').get(spaceId, 'Haushalt');

    // Sample tasks
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const insertTask = db.prepare(`
      INSERT INTO tasks (
        space_id, category_id, title, description, priority, effort,
        recurrence_type, interval_days, interval_exclude_weekends, schedule_pattern,
        has_specific_time, time_of_day, grace_period_minutes,
        next_due_date, next_due_datetime, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Task 1: Interval-based (every 3 days, no weekends)
    insertTask.run(
      spaceId, haushaltCat.id, 'Badezimmer putzen', 'Inkl. Spiegel und Waschbecken',
      'medium', 'medium', 'interval', 3, 1, null,
      0, null, 120, todayStr, null, adminId
    );

    // Task 2: Weekly schedule (Wed & Sat)
    const schedulePattern = JSON.stringify({
      type: 'weekly',
      weekdays: [3, 6],
      comment: 'Jeden Mi und Sa'
    });

    insertTask.run(
      spaceId, haushaltCat.id, 'Müll rausbringen', null,
      'high', 'quick', 'schedule', null, 0, schedulePattern,
      0, null, 120, todayStr, null, adminId
    );

    // Task 3: One-time task
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    insertTask.run(
      spaceId, haushaltCat.id, 'Glühbirne im Flur wechseln', null,
      'low', 'quick', 'one_time', null, 0, null,
      0, null, 120, tomorrowStr, null, adminId
    );

    console.log('Database seeded with sample Routines data.');
    console.log(`Space invite code: ${db.prepare('SELECT invite_code FROM spaces WHERE id = ?').get(spaceId).invite_code}`);
  }
}

migrate();
seed();

export default db;
