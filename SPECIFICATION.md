# Routinen-App - Spezifikation

> Kollaborative PWA für das Management, Planung und Tracking von Haushaltsaufgaben und Routinen

## 1. Übersicht

### 1.1 Kernziele
- Management von wiederkehrenden Aufgaben (Hausarbeit, Kinder, Finanzen, etc.)
- Shared Workspaces zwischen Haushaltsmitgliedern (z.B. Ehepartner)
- Mühelose Hauptoperationen: Anstehende Aufgaben ansehen und Aufgaben abhaken
- Automatische Benachrichtigungen für fällige Aufgaben
- Verlauf und Statistiken für alle Erledigungen

### 1.2 Nutzungsszenario
- Benutzer können mehreren "Spaces" (Arbeitsbereichen) angehören
- Jeder Space hat eigene Aufgaben, Kategorien und Einstellungen
- Hauptansicht: Unified Dashboard mit allen anstehenden Aufgaben aller Spaces
- Tägliche Digest-Benachrichtigung mit konfigurierbarem Zeitpunkt
- Echtzeit-Updates bei Änderungen durch andere Space-Mitglieder

## 2. Datenmodell

### 2.1 Bestehende Tabellen (unverändert)

#### `users`
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  notification_time TEXT DEFAULT '08:00', -- Neue Spalte für Daily Digest
  digest_filter TEXT DEFAULT 'overdue_and_today', -- 'overdue_and_today' | 'today_only' | 'next_7_days'
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### `workspaces` → Umbenennen zu `spaces`
```sql
CREATE TABLE spaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### `workspace_members` → Umbenennen zu `space_members`
```sql
CREATE TABLE space_members (
  space_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member', -- 'owner' | 'member'
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (space_id, user_id),
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### `push_subscriptions` (unverändert)
```sql
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### `sessions` (unverändert)
```sql
CREATE TABLE sessions (
  sid TEXT PRIMARY KEY,
  expire INTEGER NOT NULL,
  sess TEXT NOT NULL
);
```

### 2.2 Neue Tabellen

#### `categories`
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  space_id INTEGER NOT NULL,
  name TEXT NOT NULL, -- z.B. "Haushalt", "Kinder", "Finanzen", "Garten", "Pflege"
  color TEXT, -- Hex-Farbe für UI, z.B. "#FF5722"
  icon TEXT, -- Material Design Icon Name, z.B. "mdi-home"
  position INTEGER DEFAULT 0, -- Für Sortierung
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  UNIQUE(space_id, name)
);

CREATE INDEX idx_categories_space ON categories(space_id);
```

#### `tasks` (ersetzt `todos`)
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  space_id INTEGER NOT NULL,
  category_id INTEGER,

  -- Basis-Info
  title TEXT NOT NULL,
  description TEXT, -- Optional, für Details

  -- Zuweisung
  assigned_to TEXT, -- Komma-separierte User-IDs, z.B. "1,2" oder NULL für "anyone"

  -- Priorität & Aufwand
  priority TEXT DEFAULT 'medium', -- 'low' | 'medium' | 'high'
  effort TEXT DEFAULT 'medium', -- 'quick' | 'medium' | 'long'

  -- Wiederholungsmuster
  recurrence_type TEXT NOT NULL, -- 'one_time' | 'interval' | 'schedule'

  -- Für interval (Typ a): "every X days"
  interval_days INTEGER, -- z.B. 3 für "alle 3 Tage"
  interval_exclude_weekends INTEGER DEFAULT 0, -- 1 = Wochenenden überspringen

  -- Für schedule (Typ b): flexible Cron-artige Patterns
  schedule_pattern TEXT, -- JSON: siehe Abschnitt 2.3

  -- Zeitsteuerung
  has_specific_time INTEGER DEFAULT 0, -- 0 = nur Datum, 1 = mit Uhrzeit
  time_of_day TEXT, -- HH:MM, z.B. "14:00" (nur wenn has_specific_time = 1)
  grace_period_minutes INTEGER DEFAULT 120, -- Nachfrist pro Aufgabe (Standard: 2h)

  -- Nächste Fälligkeit (wird automatisch berechnet)
  next_due_date TEXT, -- YYYY-MM-DD
  next_due_datetime TEXT, -- ISO datetime (nur wenn has_specific_time = 1)

  -- Letzte Erledigung
  last_completed_at TEXT,
  last_completed_by INTEGER,

  -- Metadaten
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (last_completed_by) REFERENCES users(id)
);

CREATE INDEX idx_tasks_space ON tasks(space_id);
CREATE INDEX idx_tasks_next_due_date ON tasks(next_due_date) WHERE next_due_date IS NOT NULL;
CREATE INDEX idx_tasks_next_due_datetime ON tasks(next_due_datetime) WHERE next_due_datetime IS NOT NULL;
```

#### `completions`
```sql
CREATE TABLE completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,

  -- Wer & Wann
  completed_by INTEGER NOT NULL,
  completed_at TEXT DEFAULT (datetime('now')),

  -- War es überfällig?
  was_overdue INTEGER DEFAULT 0,
  days_overdue INTEGER DEFAULT 0,

  -- Zusätzliche Infos (optional)
  notes TEXT,
  photo_urls TEXT, -- JSON array von URLs
  links TEXT, -- JSON array von URLs

  -- Wurde übersprungen statt erledigt?
  skipped INTEGER DEFAULT 0,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id)
);

CREATE INDEX idx_completions_task ON completions(task_id);
CREATE INDEX idx_completions_user ON completions(completed_by);
CREATE INDEX idx_completions_date ON completions(completed_at);
```

#### `notifications_sent`
```sql
-- Tracking welche Benachrichtigungen bereits gesendet wurden
CREATE TABLE notifications_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  notification_type TEXT NOT NULL, -- 'daily_digest' | 'task_due' | 'task_overdue'
  sent_at TEXT DEFAULT (datetime('now')),
  for_due_date TEXT, -- YYYY-MM-DD für daily_digest
  for_due_datetime TEXT, -- ISO datetime für task_due

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_task_user ON notifications_sent(task_id, user_id);
CREATE INDEX idx_notifications_sent_at ON notifications_sent(sent_at);
```

### 2.3 Schedule Pattern Format (JSON)

Für `recurrence_type = 'schedule'` wird ein flexibles JSON-Format verwendet:

```json
{
  "type": "weekly",
  "weekdays": [1, 3, 6],
  "comment": "Jeden Mo, Mi, Sa"
}
```

```json
{
  "type": "monthly",
  "days": [1, 15],
  "comment": "Am 1. und 15. jeden Monats"
}
```

```json
{
  "type": "monthly_weekday",
  "week": 2,
  "weekday": 1,
  "comment": "Jeden 2. Montag im Monat"
}
```

```json
{
  "type": "cron",
  "expression": "0 0 1,15 * *",
  "comment": "Custom cron: 1. und 15. jeden Monats"
}
```

```json
{
  "type": "specific_dates",
  "dates": ["2026-01-15", "2026-07-20", "2026-12-25"],
  "comment": "Spezifische Termine (Geburtstage, Jahrestage)"
}
```

**Wochentage-Kodierung:**
- 0 = Sonntag
- 1 = Montag
- 2 = Dienstag
- 3 = Mittwoch
- 4 = Donnerstag
- 5 = Freitag
- 6 = Samstag

## 3. Business Logic

### 3.1 Aufgabentypen

#### Typ 1: One-Time (Einmalig)
```javascript
{
  recurrence_type: 'one_time',
  next_due_date: '2026-01-15'
}
```
- Bei Erledigung: `next_due_date` wird auf NULL gesetzt (Aufgabe verschwindet aus aktiver Liste)
- Kann manuell reaktiviert werden

#### Typ 2: Interval (Frequenz-basiert)
```javascript
{
  recurrence_type: 'interval',
  interval_days: 3,
  interval_exclude_weekends: 1
}
```
- **Regel:** Nächste Fälligkeit = `Erledigungs-Zeitpunkt + interval_days`
- **Mit `exclude_weekends = 1`:** Falls berechnetes Datum auf Wochenende fällt, verschieben auf nächsten Montag
- **Beispiel:** Aufgabe alle 3 Tage, erledigt am 2026-01-02 (Do) → nächste Fälligkeit: 2026-01-05 (So) → verschoben auf 2026-01-06 (Mo)

#### Typ 3: Schedule (Zeitplan-basiert)
```javascript
{
  recurrence_type: 'schedule',
  schedule_pattern: '{"type":"weekly","weekdays":[1,3,6]}'
}
```
- **Regel:** Nächste Fälligkeit wird aus Pattern berechnet, unabhängig vom Erledigungs-Zeitpunkt
- **Beispiel:** Müll raus jeden Mi (3) und Sa (6)
  - Erledigt am Do (zu spät) → nächste Fälligkeit bleibt Sa
  - Erledigt am Sa → nächste Fälligkeit: Mi

### 3.2 Berechnung der nächsten Fälligkeit

#### Nach Erledigung:
```
IF recurrence_type = 'one_time':
  SET next_due_date = NULL

ELSE IF recurrence_type = 'interval':
  base_date = completed_at
  next_date = base_date + interval_days

  IF interval_exclude_weekends = 1 AND next_date is weekend:
    next_date = next Monday

  SET next_due_date = next_date
  IF has_specific_time = 1:
    SET next_due_datetime = next_date + time_of_day

ELSE IF recurrence_type = 'schedule':
  next_date = calculate_next_from_pattern(schedule_pattern, from: now())

  SET next_due_date = next_date
  IF has_specific_time = 1:
    SET next_due_datetime = next_date + time_of_day
```

#### Pattern-Berechnung Beispiele:

**Weekly Pattern:**
```javascript
// schedule_pattern: {"type":"weekly","weekdays":[1,3,6]}
// Heute: 2026-01-02 (Fr)
// Nächste Termine: Sa 2026-01-03, Mo 2026-01-05, Mi 2026-01-07
// → Nächste Fälligkeit: 2026-01-03
```

**Monthly Pattern:**
```javascript
// schedule_pattern: {"type":"monthly","days":[1,15]}
// Heute: 2026-01-10
// Nächster Termin: 15. Januar
// → Nächste Fälligkeit: 2026-01-15
```

### 3.3 Überfälligkeits-Logik

#### Für Aufgaben ohne Uhrzeit (`has_specific_time = 0`):
```
is_overdue = next_due_date < today()
grace_period_applicable = false
```

#### Für Aufgaben mit Uhrzeit (`has_specific_time = 1`):
```
grace_deadline = next_due_datetime + grace_period_minutes
is_overdue = now() > grace_deadline
grace_period_applicable = true
```

**Standard:** `grace_period_minutes = 120` (2 Stunden), konfigurierbar pro Aufgabe

#### Überfälligkeits-Anzeige:
- **Grau:** Zukünftig (noch nicht fällig)
- **Gelb/Orange:** Heute fällig (nicht überfällig)
- **Rot:** Überfällig

### 3.4 Erledigung und Skip

#### Normale Erledigung:
```javascript
POST /api/spaces/:spaceId/tasks/:taskId/complete
{
  notes: "Optional",
  photo_urls: ["url1", "url2"],
  links: ["https://..."]
}

// Backend-Logik:
1. Erstelle completion-Eintrag:
   - completed_by = current_user_id
   - completed_at = now()
   - was_overdue = is_overdue(task)
   - days_overdue = calculate_days_overdue(task)
   - notes, photo_urls, links

2. Aktualisiere task:
   - last_completed_at = now()
   - last_completed_by = current_user_id
   - next_due_date/datetime = calculate_next_due(task)

3. Sende SSE-Event an Space-Mitglieder:
   - "task_completed" event

4. Sende Push-Benachrichtigung an andere Space-Mitglieder:
   - "{User} hat {Task} erledigt"
```

#### Skip (Überspringen):
```javascript
POST /api/spaces/:spaceId/tasks/:taskId/skip
{
  notes: "Warum übersprungen"
}

// Backend-Logik:
1. Erstelle completion-Eintrag mit skipped = 1

2. Aktualisiere task:
   - next_due_date/datetime = calculate_next_due(task)
   - last_completed_at bleibt unverändert (!)

3. Keine Benachrichtigung an andere Mitglieder
```

**Unterschied:** Skip zählt nicht als Erledigung für Statistiken, berechnet aber trotzdem die nächste Fälligkeit.

## 4. API-Endpunkte

### 4.1 Authentifizierung (unverändert)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 4.2 Benutzer-Einstellungen (neu)
- `PATCH /api/users/settings`
  ```json
  {
    "notification_time": "08:00",
    "digest_filter": "overdue_and_today"
  }
  ```

### 4.3 Spaces (vorher `workspaces`)
- `GET /api/spaces` - Alle Spaces des Users
- `POST /api/spaces` - Neuen Space erstellen
- `GET /api/spaces/:id` - Space-Details mit Mitgliedern
- `PATCH /api/spaces/:id` - Space aktualisieren (Name, grace_period_minutes)
- `DELETE /api/spaces/:id` - Space löschen (nur Owner)
- `POST /api/spaces/join` - Space beitreten (via invite_code)
- `POST /api/spaces/:id/leave` - Space verlassen

### 4.4 Kategorien (neu)
- `GET /api/spaces/:spaceId/categories` - Alle Kategorien des Spaces
- `POST /api/spaces/:spaceId/categories` - Kategorie erstellen
  ```json
  {
    "name": "Haushalt",
    "color": "#FF5722",
    "icon": "mdi-home"
  }
  ```
- `PATCH /api/spaces/:spaceId/categories/:id` - Kategorie aktualisieren
- `DELETE /api/spaces/:spaceId/categories/:id` - Kategorie löschen
- `POST /api/spaces/:spaceId/categories/reorder` - Reihenfolge ändern
  ```json
  {
    "category_ids": [3, 1, 2, 5, 4]
  }
  ```

### 4.5 Aufgaben (neu, ersetzt `todos`)
- `GET /api/spaces/:spaceId/tasks` - Alle Aufgaben des Spaces
  ```javascript
  // Response inkl. Berechnung:
  [
    {
      id: 1,
      title: "Müll rausbringen",
      category: { id: 1, name: "Haushalt", color: "#FF5722" },
      priority: "high",
      effort: "quick",
      next_due_date: "2026-01-03",
      next_due_datetime: null,
      is_overdue: false,
      days_until_due: 1,
      last_completed_at: "2026-01-01T10:30:00Z",
      last_completed_by: { id: 1, email: "user@example.com" },
      assigned_to: [1, 2], // User-IDs
      recurrence_type: "schedule",
      schedule_pattern: '{"type":"weekly","weekdays":[3,6]}'
    }
  ]
  ```

- `GET /api/tasks/dashboard` - **Unified Dashboard** (alle Spaces)
  ```javascript
  // Query params:
  // ?filter=overdue|today|upcoming|all
  // ?space_id=1,2,3 (optional)
  // ?category_id=1,2 (optional)
  // ?assigned_to=me|all (default: all)

  // Response grouped by status:
  {
    overdue: [ /* tasks */ ],
    today: [ /* tasks */ ],
    upcoming: [ /* tasks */ ]
  }
  ```

- `POST /api/spaces/:spaceId/tasks` - Aufgabe erstellen
  ```json
  {
    "title": "Badezimmer putzen",
    "description": "Inkl. Spiegel und Waschbecken",
    "category_id": 1,
    "assigned_to": [1, 2],
    "priority": "medium",
    "effort": "medium",
    "recurrence_type": "interval",
    "interval_days": 3,
    "interval_exclude_weekends": true,
    "has_specific_time": false,
    "next_due_date": "2026-01-05"
  }
  ```

- `PATCH /api/spaces/:spaceId/tasks/:id` - Aufgabe aktualisieren

- `DELETE /api/spaces/:spaceId/tasks/:id` - Aufgabe löschen

- `POST /api/spaces/:spaceId/tasks/:id/complete` - Aufgabe erledigen
  ```json
  {
    "notes": "Alles sauber!",
    "photo_urls": ["https://..."],
    "links": ["https://..."]
  }
  ```

- `POST /api/spaces/:spaceId/tasks/:id/skip` - Aufgabe überspringen
  ```json
  {
    "notes": "Keine Zeit heute"
  }
  ```

### 4.6 Verlauf & Statistiken (neu)
- `GET /api/spaces/:spaceId/tasks/:taskId/completions` - Erledigungs-Verlauf
  ```javascript
  // Response:
  [
    {
      id: 1,
      completed_by: { id: 1, email: "user@example.com" },
      completed_at: "2026-01-01T10:30:00Z",
      was_overdue: false,
      days_overdue: 0,
      skipped: false,
      notes: "Alles gut",
      photo_urls: [],
      links: []
    }
  ]
  ```

- `DELETE /api/spaces/:spaceId/tasks/:taskId/completions/:completionId` - Verlaufs-Eintrag löschen (manuelles Purging)

- `GET /api/spaces/:spaceId/statistics` - Space-Statistiken
  ```javascript
  // Response:
  {
    total_tasks: 25,
    completed_this_week: 18,
    overdue: 3,
    completion_rate: 0.95,

    by_category: [
      { category: "Haushalt", count: 12, completion_rate: 0.92 }
    ],

    by_user: [
      { user: { id: 1, email: "..." }, count: 10, completion_rate: 0.95 }
    ],

    recent_completions: [ /* last 10 completions */ ]
  }
  ```

### 4.7 Push-Benachrichtigungen (erweitert)
- `GET /api/push/vapid-public-key` (unverändert)
- `POST /api/push/subscribe` (unverändert)
- `DELETE /api/push/subscribe` (unverändert)

### 4.8 Server-Sent Events (erweitert)
- `GET /api/sse/spaces/:spaceId` (vorher `/workspaces/:id`)
  ```javascript
  // Event types:
  - task_created
  - task_updated
  - task_deleted
  - task_completed
  - task_skipped
  - category_created
  - category_updated
  - category_deleted
  ```

## 5. Benachrichtigungs-System

### 5.1 Daily Digest (Tägliche Zusammenfassung)

**Scheduler (Cron):**
- Läuft jede Minute: `* * * * *`
- Prüft für jeden User: Ist jetzt die `notification_time`?
- Falls ja, prüfe `digest_filter` und sende Benachrichtigung

**Logik:**
```javascript
FOR each user:
  IF current_time matches user.notification_time (innerhalb 1 Minute):

    tasks = get_tasks_for_digest(user, user.digest_filter)

    IF tasks already notified today:
      SKIP

    IF tasks.length > 0:
      IF tasks.length <= 3:
        title = "Aufgaben für heute"
        body = tasks.map(t => t.title).join("\n")
      ELSE:
        title = `${tasks.length} Aufgaben für heute`
        body = "Tippen um Details anzuzeigen"

      send_push_notification(user, {
        title,
        body,
        data: { type: 'daily_digest', url: '/dashboard' },
        actions: [
          { action: 'view', title: 'Ansehen' },
          { action: 'dismiss', title: 'Später' }
        ]
      })

      record_notification_sent(user, 'daily_digest', today)
```

**Filter-Typen:**
- `overdue_and_today`: Überfällige + heute fällige Aufgaben
- `today_only`: Nur heute fällige Aufgaben
- `next_7_days`: Aufgaben der nächsten 7 Tage

### 5.2 Task Due Notification (Zeitspezifische Benachrichtigung)

Für Aufgaben mit `has_specific_time = 1`:

**Scheduler:**
- Läuft jede Minute: `* * * * *`
- Findet Aufgaben mit `next_due_datetime` in den nächsten 1 Minute
- Sendet Benachrichtigung an assigned users (oder alle Space-Mitglieder falls nicht zugewiesen)

**Logik:**
```javascript
tasks = SELECT * FROM tasks
        WHERE has_specific_time = 1
        AND next_due_datetime BETWEEN now() AND now() + 1 minute
        AND NOT EXISTS notification_sent for this due_datetime

FOR each task:
  users = task.assigned_to OR space_members(task.space_id)

  FOR each user:
    send_push_notification(user, {
      title: task.title,
      body: `Fällig: ${format_time(task.next_due_datetime)}`,
      data: {
        type: 'task_due',
        task_id: task.id,
        space_id: task.space_id
      },
      actions: [
        { action: 'complete', title: 'Erledigt' },
        { action: 'skip', title: 'Überspringen' },
        { action: 'view', title: 'Ansehen' }
      ]
    })

    record_notification_sent(user, task, 'task_due', task.next_due_datetime)
```

### 5.3 Notification Actions (Interaktive Buttons)

**Empfohlene Actions:**

1. **Daily Digest:**
   - `view`: Öffnet Dashboard
   - `dismiss`: Schließt Benachrichtigung

2. **Task Due:**
   - `complete`: Markiert Aufgabe als erledigt (ohne Notes/Photos)
   - `skip`: Überspringt Aufgabe
   - `view`: Öffnet Aufgaben-Details

3. **Task Completed (von anderem User):**
   - `view`: Öffnet Aufgaben-Details
   - `dismiss`: Schließt Benachrichtigung

**Implementation:**
```javascript
// Service Worker: sw-custom.js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action, data } = event;

  if (action === 'complete') {
    // POST /api/spaces/:spaceId/tasks/:taskId/complete
    fetch(`/api/spaces/${data.space_id}/tasks/${data.task_id}/complete`, {
      method: 'POST',
      credentials: 'include'
    });
  }

  else if (action === 'skip') {
    fetch(`/api/spaces/${data.space_id}/tasks/${data.task_id}/skip`, {
      method: 'POST',
      credentials: 'include'
    });
  }

  else if (action === 'view') {
    clients.openWindow(data.url || '/dashboard');
  }
});
```

## 6. Frontend-Änderungen

### 6.1 Routing

```javascript
// router.js
const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },

  // Hauptansicht: Unified Dashboard
  { path: '/dashboard', component: DashboardView, meta: { requiresAuth: true } },

  // Space-spezifische Ansichten
  { path: '/spaces', component: SpacesListView, meta: { requiresAuth: true } },
  { path: '/spaces/:id', component: SpaceView, meta: { requiresAuth: true } },
  { path: '/spaces/:id/statistics', component: SpaceStatisticsView, meta: { requiresAuth: true } },

  // Aufgaben
  { path: '/spaces/:spaceId/tasks/new', component: TaskFormView, meta: { requiresAuth: true } },
  { path: '/spaces/:spaceId/tasks/:taskId', component: TaskDetailView, meta: { requiresAuth: true } },
  { path: '/spaces/:spaceId/tasks/:taskId/edit', component: TaskFormView, meta: { requiresAuth: true } },

  // Einstellungen
  { path: '/settings', component: SettingsView, meta: { requiresAuth: true } },
];
```

### 6.2 Pinia Stores

#### `authStore` (erweitert)
```javascript
// stores/auth.js
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null, // { id, email, notification_time, digest_filter }
    checked: false,
    loading: false
  }),

  actions: {
    async updateSettings({ notification_time, digest_filter }) {
      await api.patch('/users/settings', { notification_time, digest_filter });
      this.user = { ...this.user, notification_time, digest_filter };
    }
  }
});
```

#### `spacesStore` (ersetzt `workspacesStore`)
```javascript
// stores/spaces.js
export const useSpacesStore = defineStore('spaces', {
  state: () => ({
    spaces: [], // Liste aller Spaces
    currentSpace: null,
    loading: false
  }),

  getters: {
    spaceById: (state) => (id) => state.spaces.find(s => s.id === id)
  },

  actions: {
    async fetchSpaces() { /* GET /api/spaces */ },
    async createSpace(data) { /* POST /api/spaces */ },
    async updateSpace(id, data) { /* PATCH /api/spaces/:id */ },
    async deleteSpace(id) { /* DELETE /api/spaces/:id */ },
    async joinSpace(inviteCode) { /* POST /api/spaces/join */ },
    async leaveSpace(id) { /* POST /api/spaces/:id/leave */ }
  }
});
```

#### `categoriesStore` (neu)
```javascript
// stores/categories.js
export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    categoriesBySpace: {}, // { spaceId: [categories] }
    loading: false
  }),

  getters: {
    categoriesForSpace: (state) => (spaceId) => state.categoriesBySpace[spaceId] || []
  },

  actions: {
    async fetchCategories(spaceId) { /* GET /api/spaces/:id/categories */ },
    async createCategory(spaceId, data) { /* POST */ },
    async updateCategory(spaceId, categoryId, data) { /* PATCH */ },
    async deleteCategory(spaceId, categoryId) { /* DELETE */ },
    async reorderCategories(spaceId, categoryIds) { /* POST /reorder */ }
  }
});
```

#### `tasksStore` (ersetzt `todosStore`)
```javascript
// stores/tasks.js
export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasksBySpace: {}, // { spaceId: [tasks] }
    dashboardTasks: null, // { overdue: [], today: [], upcoming: [] }
    loading: false
  }),

  getters: {
    tasksForSpace: (state) => (spaceId) => state.tasksBySpace[spaceId] || [],

    overdueTasks: (state) => state.dashboardTasks?.overdue || [],
    todayTasks: (state) => state.dashboardTasks?.today || [],
    upcomingTasks: (state) => state.dashboardTasks?.upcoming || []
  },

  actions: {
    async fetchDashboard(filters = {}) {
      // GET /api/tasks/dashboard?filter=...
      this.dashboardTasks = await api.get('/tasks/dashboard', { params: filters });
    },

    async fetchTasksForSpace(spaceId) {
      // GET /api/spaces/:id/tasks
      this.tasksBySpace[spaceId] = await api.get(`/spaces/${spaceId}/tasks`);
    },

    async createTask(spaceId, data) { /* POST */ },
    async updateTask(spaceId, taskId, data) { /* PATCH */ },
    async deleteTask(spaceId, taskId) { /* DELETE */ },

    async completeTask(spaceId, taskId, { notes, photo_urls, links }) {
      // POST /api/spaces/:id/tasks/:id/complete
      await api.post(`/spaces/${spaceId}/tasks/${taskId}/complete`, {
        notes, photo_urls, links
      });
      await this.fetchDashboard(); // Refresh
    },

    async skipTask(spaceId, taskId, { notes }) {
      // POST /api/spaces/:id/tasks/:id/skip
      await api.post(`/spaces/${spaceId}/tasks/${taskId}/skip`, { notes });
      await this.fetchDashboard();
    },

    handleSSEMessage({ type, data }) {
      // Real-time updates from SSE
      if (type === 'task_completed') {
        this.fetchDashboard();
        // Optional: Show toast notification
      }
    }
  }
});
```

#### `statisticsStore` (neu)
```javascript
// stores/statistics.js
export const useStatisticsStore = defineStore('statistics', {
  state: () => ({
    statsBySpace: {}, // { spaceId: { ... } }
    loading: false
  }),

  actions: {
    async fetchStatistics(spaceId) {
      // GET /api/spaces/:id/statistics
      this.statsBySpace[spaceId] = await api.get(`/spaces/${spaceId}/statistics`);
    }
  }
});
```

### 6.3 Hauptkomponenten

#### `DashboardView.vue` (neu, Hauptansicht)
```vue
<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>Übersicht</h1>

        <!-- Filters -->
        <v-chip-group v-model="selectedFilter" mandatory>
          <v-chip value="all">Alle</v-chip>
          <v-chip value="overdue">Überfällig</v-chip>
          <v-chip value="today">Heute</v-chip>
          <v-chip value="upcoming">Demnächst</v-chip>
        </v-chip-group>

        <!-- Space Filter -->
        <v-select
          v-model="selectedSpaces"
          :items="spaces"
          item-title="name"
          item-value="id"
          label="Spaces"
          multiple
          chips
          clearable
        />

        <!-- Category Filter -->
        <v-select
          v-model="selectedCategories"
          :items="allCategories"
          item-title="name"
          item-value="id"
          label="Kategorien"
          multiple
          chips
          clearable
        />

        <!-- Assigned Filter -->
        <v-switch
          v-model="showOnlyMyTasks"
          label="Nur meine Aufgaben"
        />
      </v-col>
    </v-row>

    <!-- Task Groups -->
    <TaskGroup
      v-if="overdueTasks.length > 0"
      title="Überfällig"
      :tasks="overdueTasks"
      color="error"
      @complete="handleComplete"
      @skip="handleSkip"
    />

    <TaskGroup
      v-if="todayTasks.length > 0"
      title="Heute"
      :tasks="todayTasks"
      color="warning"
      @complete="handleComplete"
      @skip="handleSkip"
    />

    <TaskGroup
      v-if="upcomingTasks.length > 0"
      title="Demnächst"
      :tasks="upcomingTasks"
      @complete="handleComplete"
      @skip="handleSkip"
    />

    <v-empty-state
      v-if="!hasAnyTasks"
      icon="mdi-check-all"
      title="Alles erledigt!"
      text="Du hast keine anstehenden Aufgaben."
    />
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useTasksStore } from '@/stores/tasks';
import { useSpacesStore } from '@/stores/spaces';
import TaskGroup from '@/components/TaskGroup.vue';

const tasksStore = useTasksStore();
const spacesStore = useSpacesStore();

const selectedFilter = ref('all');
const selectedSpaces = ref([]);
const selectedCategories = ref([]);
const showOnlyMyTasks = ref(false);

const overdueTasks = computed(() => tasksStore.overdueTasks);
const todayTasks = computed(() => tasksStore.todayTasks);
const upcomingTasks = computed(() => tasksStore.upcomingTasks);
const spaces = computed(() => spacesStore.spaces);

const hasAnyTasks = computed(() =>
  overdueTasks.value.length > 0 ||
  todayTasks.value.length > 0 ||
  upcomingTasks.value.length > 0
);

onMounted(() => {
  fetchData();
});

async function fetchData() {
  await spacesStore.fetchSpaces();
  await tasksStore.fetchDashboard({
    filter: selectedFilter.value,
    space_id: selectedSpaces.value.join(','),
    category_id: selectedCategories.value.join(','),
    assigned_to: showOnlyMyTasks.value ? 'me' : 'all'
  });
}

async function handleComplete(task) {
  // Optional: Show dialog for notes/photos
  await tasksStore.completeTask(task.space_id, task.id, {});
}

async function handleSkip(task) {
  await tasksStore.skipTask(task.space_id, task.id, {});
}
</script>
```

#### `TaskGroup.vue` (neu)
```vue
<template>
  <v-card class="mb-4">
    <v-card-title :class="`text-${color}`">
      {{ title }} ({{ tasks.length }})
    </v-card-title>

    <v-list>
      <TaskItem
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        @complete="$emit('complete', task)"
        @skip="$emit('skip', task)"
        @click="navigateToTask(task)"
      />
    </v-list>
  </v-card>
</template>

<script setup>
import { useRouter } from 'vue-router';
import TaskItem from './TaskItem.vue';

defineProps({
  title: String,
  tasks: Array,
  color: { type: String, default: 'primary' }
});

defineEmits(['complete', 'skip']);

const router = useRouter();

function navigateToTask(task) {
  router.push(`/spaces/${task.space_id}/tasks/${task.id}`);
}
</script>
```

#### `TaskItem.vue` (neu, ersetzt `TodoItem.vue`)
```vue
<template>
  <v-list-item @click="$emit('click')">
    <template #prepend>
      <v-checkbox
        :model-value="false"
        @click.stop="$emit('complete')"
        hide-details
      />
    </template>

    <v-list-item-title>
      <v-chip
        v-if="task.category"
        :color="task.category.color"
        size="small"
        class="mr-2"
      >
        <v-icon start :icon="task.category.icon" />
        {{ task.category.name }}
      </v-chip>

      {{ task.title }}

      <v-chip
        v-if="task.priority === 'high'"
        color="error"
        size="x-small"
        class="ml-2"
      >
        Wichtig
      </v-chip>
    </v-list-item-title>

    <v-list-item-subtitle>
      <v-icon size="small">mdi-calendar</v-icon>
      {{ formatDueDate(task) }}

      <v-icon v-if="task.has_specific_time" size="small" class="ml-2">
        mdi-clock-outline
      </v-icon>
      {{ task.time_of_day }}

      <v-chip
        v-if="task.assigned_to?.length > 0"
        size="x-small"
        class="ml-2"
      >
        <v-icon start size="x-small">mdi-account</v-icon>
        {{ task.assigned_to.length }} Person(en)
      </v-chip>
    </v-list-item-subtitle>

    <template #append>
      <v-btn
        icon="mdi-skip-next"
        size="small"
        variant="text"
        @click.stop="$emit('skip')"
      />
    </template>
  </v-list-item>
</template>

<script setup>
defineProps({
  task: Object
});

defineEmits(['click', 'complete', 'skip']);

function formatDueDate(task) {
  // Format next_due_date nicely
  const date = new Date(task.next_due_date);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return 'Heute';
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Morgen';
  }

  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}
</script>
```

#### `TaskFormView.vue` (neu)
Formular für Erstellen/Bearbeiten von Aufgaben mit:
- Titel, Beschreibung
- Kategorie-Auswahl
- **Zuweisungs-Auswahl:**
  - Radio: "Jeder" (default) / "Bestimmte Personen"
  - Falls "Bestimmte Personen": Multi-Select Dropdown mit Chips für Space-Mitglieder
- Priorität, Aufwand
- **Wiederholungsmuster-Auswahl (MVP: Simple UI):**
  - Radio buttons: Einmalig / Intervall / Wöchentlich / Monatlich
  - Wenn Intervall: Anzahl Tage + Checkbox "Wochenenden ausschließen"
  - Wenn Wöchentlich: Checkboxes für Wochentage (Mo, Di, Mi, Do, Fr, Sa, So)
  - Wenn Monatlich: Multi-Select für Tage (1-31)
- Datum/Zeit-Picker
  - Checkbox "Spezifische Uhrzeit"
  - Falls aktiviert: Time-Picker + Grace Period (Minuten)

#### `SpaceView.vue` (ersetzt `WorkspaceView.vue`)
Liste der Aufgaben eines bestimmten Spaces (gefiltert/sortiert).

#### `TaskDetailView.vue` (neu)
Detail-Ansicht einer Aufgabe mit:
- Alle Aufgaben-Infos
- **Verlauf-Tabelle:**
  - Wann erledigt, von wem
  - War es überfällig?
  - Notes, Photos, Links
  - Skipped?
- Buttons: Bearbeiten, Löschen

#### `SpaceStatisticsView.vue` (neu)
Statistiken für einen Space:
- Gesamt-Anzahl Aufgaben
- Diese Woche erledigt
- Überfällig
- Erledigungsrate
- Charts:
  - Nach Kategorie
  - Nach Benutzer
  - Zeitverlauf (Completions pro Woche)

#### `SettingsView.vue` (neu)
Benutzer-Einstellungen:
- Benachrichtigungszeit (Time-Picker)
- Digest-Filter (Radio buttons)
- Push-Benachrichtigungen aktivieren/deaktivieren

### 6.4 Composables (erweitert)

#### `useRecurrence.js` (neu)
```javascript
// composables/useRecurrence.js
export function useRecurrence() {
  function calculateNextDue(task, fromDate = new Date()) {
    if (task.recurrence_type === 'one_time') {
      return null;
    }

    if (task.recurrence_type === 'interval') {
      return calculateIntervalNext(task, fromDate);
    }

    if (task.recurrence_type === 'schedule') {
      return calculateScheduleNext(task, fromDate);
    }
  }

  function calculateIntervalNext(task, fromDate) {
    let nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + task.interval_days);

    if (task.interval_exclude_weekends) {
      const day = nextDate.getDay();
      if (day === 0) nextDate.setDate(nextDate.getDate() + 1); // Sunday -> Monday
      if (day === 6) nextDate.setDate(nextDate.getDate() + 2); // Saturday -> Monday
    }

    return nextDate.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  function calculateScheduleNext(task, fromDate) {
    const pattern = JSON.parse(task.schedule_pattern);

    if (pattern.type === 'weekly') {
      return calculateWeeklyNext(pattern.weekdays, fromDate);
    }

    if (pattern.type === 'monthly') {
      return calculateMonthlyNext(pattern.days, fromDate);
    }

    // ... weitere Pattern-Typen
  }

  function calculateWeeklyNext(weekdays, fromDate) {
    const sorted = [...weekdays].sort((a, b) => a - b);
    let current = new Date(fromDate);
    current.setDate(current.getDate() + 1); // Start from tomorrow

    // Find next matching weekday
    for (let i = 0; i < 14; i++) { // Check next 2 weeks
      const day = current.getDay();
      if (sorted.includes(day)) {
        return current.toISOString().split('T')[0];
      }
      current.setDate(current.getDate() + 1);
    }
  }

  function calculateMonthlyNext(days, fromDate) {
    // Similar logic for monthly patterns
  }

  function formatRecurrence(task) {
    if (task.recurrence_type === 'one_time') {
      return 'Einmalig';
    }

    if (task.recurrence_type === 'interval') {
      const days = task.interval_days;
      const excludeWeekends = task.interval_exclude_weekends ? ' (ohne Wochenenden)' : '';
      return `Alle ${days} Tag${days > 1 ? 'e' : ''}${excludeWeekends}`;
    }

    if (task.recurrence_type === 'schedule') {
      const pattern = JSON.parse(task.schedule_pattern);
      return pattern.comment || 'Zeitplan';
    }
  }

  return {
    calculateNextDue,
    formatRecurrence
  };
}
```

## 7. Deployment & Migration

### 7.1 Datenbank-Migration

Da wir von Grund auf neu starten:

```javascript
// packages/server/src/db.js

// DROP all old tables
db.exec('DROP TABLE IF EXISTS todos');
db.exec('DROP TABLE IF EXISTS workspace_members');
db.exec('DROP TABLE IF EXISTS workspaces');
db.exec('DROP TABLE IF EXISTS push_subscriptions');
db.exec('DROP TABLE IF EXISTS users');
db.exec('DROP TABLE IF EXISTS sessions');

// CREATE new schema (siehe Abschnitt 2)

// Seed data
const adminUser = db.prepare(`
  INSERT INTO users (email, password_hash, notification_time, digest_filter)
  VALUES (?, ?, '08:00', 'overdue_and_today')
`).run('mail@michoest.com', bcrypt.hashSync('admin', 10));

const space = db.prepare(`
  INSERT INTO spaces (name, owner_id, invite_code)
  VALUES ('Haushalt', ?, ?)
`).run(adminUser.lastInsertRowid, nanoid(10));

db.prepare(`
  INSERT INTO space_members (space_id, user_id, role)
  VALUES (?, ?, 'owner')
`).run(space.lastInsertRowid, adminUser.lastInsertRowid);

// Default categories (customizable per Space)
// Diese werden nur als Beispiel für den ersten Space erstellt
const defaultCategories = ['Haushalt', 'Kinder', 'Finanzen', 'Garten', 'Pflege'];
const defaultColors = ['#FF5722', '#4CAF50', '#2196F3', '#8BC34A', '#9C27B0'];
const defaultIcons = ['mdi-home', 'mdi-baby-face', 'mdi-currency-eur', 'mdi-flower', 'mdi-hospital-box'];

defaultCategories.forEach((name, i) => {
  db.prepare(`
    INSERT INTO categories (space_id, name, color, icon, position)
    VALUES (?, ?, ?, ?, ?)
  `).run(space.lastInsertRowid, name, defaultColors[i], defaultIcons[i], i);
});

// Sample tasks
db.prepare(`
  INSERT INTO tasks (
    space_id, category_id, title, priority, effort,
    recurrence_type, interval_days, interval_exclude_weekends,
    next_due_date, created_by
  ) VALUES (?, ?, 'Badezimmer putzen', 'medium', 'medium', 'interval', 3, 1, date('now'), ?)
`).run(space.lastInsertRowid, 1, adminUser.lastInsertRowid);

db.prepare(`
  INSERT INTO tasks (
    space_id, category_id, title, priority, effort,
    recurrence_type, schedule_pattern,
    next_due_date, created_by
  ) VALUES (?, ?, 'Müll rausbringen', 'high', 'quick', 'schedule',
    '{"type":"weekly","weekdays":[3,6],"comment":"Jeden Mi und Sa"}',
    date('now'), ?)
`).run(space.lastInsertRowid, 1, adminUser.lastInsertRowid);
```

### 7.2 Environment Variables

Keine Änderungen gegenüber bestehender Konfiguration:

**Server (`.env`):**
```env
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-secret-key
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:...
```

**Client (`.env`):**
```env
VITE_API_BASE=/api
```

## 8. Offene Fragen & Erweiterungen

### 8.1 Nice-to-Have Features (Zukunft)

- **Attachments:** Foto-Upload direkt in der App (statt URLs)
- **Subtasks:** Aufgaben mit Checklisten
- **Templates:** Vordefinierte Aufgaben-Sets (z.B. "Frühjahrsputz")
- **Gamification:** Punkte, Streaks, Achievements
- **Kalender-View:** Monatsansicht mit allen Aufgaben
- **Export:** PDF/CSV-Export von Statistiken
- **Reminder-Customization:** Benutzer wählt für jede Aufgabe individuell, wann Reminder gesendet werden soll
- **Multi-Language:** Englisch/Deutsch umschaltbar

### 8.2 Technische Verbesserungen (Optional)

- **Datenbank:** Migration von SQLite zu PostgreSQL für bessere Performance bei vielen Nutzern
- **Caching:** Redis für Session-Store und API-Caching
- **File Storage:** S3 oder ähnlich für Foto-Uploads
- **Analytics:** Tracking von Nutzungsmetriken
- **Error Monitoring:** Sentry-Integration
- **Testing:** Unit & E2E Tests

### 8.3 MVP Design-Entscheidungen (bereits festgelegt)

1. **Pattern-Builder UI:** ✅ Simple UI
   - MVP: Einmalig, Intervall, Wöchentlich, Monatlich
   - Zukunft: Specific Dates, Cron Expression Editor

2. **Photo/Link Handling:** ✅ Text-URLs für MVP
   - MVP: Text-Eingabe für URLs (Photos & Links)
   - Zukunft: File Upload mit Backend-Storage

3. **Completion Notes:** ✅ Plain text für MVP
   - MVP: Plain text
   - Zukunft: Markdown oder Voice notes

4. **Assignment UI:** ✅ Radio + Multi-Select Dropdown
   - Radio: "Jeder" (default) / "Bestimmte Personen"
   - Multi-Select Dropdown mit Chips für Space-Mitglieder

5. **Grace Period:** ✅ Per-Task Setting
   - Standardwert: 120 Minuten (2 Stunden)
   - Konfigurierbar beim Erstellen/Bearbeiten jeder Aufgabe

6. **Categories:** ✅ Customizable per Space
   - Keine hardcoded Categories
   - Jeder Space kann eigene Categories erstellen
   - Default-Categories beim Space-Setup als Vorschlag

---

**Ende der Spezifikation**

Version: 1.0
Datum: 2026-01-02
Status: Entwurf - Wartet auf Review
