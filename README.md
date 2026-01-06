# Collaborative To-Do App

Ein kollaboratives Todo-PWA mit Echtzeit-Benachrichtigungen und Multi-Workspace-Unterstützung.

## Tech Stack

- **Backend**: Express.js, SQLite (better-sqlite3), Session-basierte Authentifizierung
- **Frontend**: Vue 3 (Composition API), Vuetify 3, Pinia
- **PWA**: Service Worker, Web Push Notifications, Offline-Support
- **Monorepo**: npm workspaces

## Features

✅ **Multi-Workspace Support** - Erstellen und teilen Sie Arbeitsbereiche mit Einladungscodes
✅ **Echtzeit-Benachrichtigungen** - Push-Benachrichtigungen wenn Aufgaben erledigt werden
✅ **Reminder** - Setzen Sie Erinnerungen für Aufgaben
✅ **PWA** - Installierbar auf Desktop und Mobile
✅ **Offline-Support** - Funktioniert auch offline mit intelligenter Synchronisierung
✅ **Session-basierte Auth** - Sichere, HTTP-only Cookie-Authentifizierung
✅ **Kollaboration** - Arbeiten Sie gemeinsam an Aufgaben

## Schnellstart

### Voraussetzungen

- Node.js 18+ (getestet mit Node 24.x)
- npm 8+

### Installation

1. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```

2. **Entwicklungsserver starten**
   ```bash
   npm run dev
   ```

   Dies startet:
   - Backend-Server auf http://localhost:3000
   - Frontend-Dev-Server auf http://localhost:5173

3. **Anmelden**
   - E-Mail: `mail@michoest.com`
   - Passwort: `admin`

## Projektstruktur

```
mobile-0/
├── package.json              # Workspace-Root
├── packages/
│   ├── server/               # Express Backend
│   │   ├── src/
│   │   │   ├── index.js     # Express-Server
│   │   │   ├── db.js        # Datenbank & Migrations
│   │   │   ├── auth.js      # Session-Middleware
│   │   │   ├── push.js      # Push-Benachrichtigungen
│   │   │   ├── scheduler.js # Reminder-Cron
│   │   │   └── routes/      # API-Routen
│   │   └── data/            # SQLite-Datenbank (gitignored)
│   └── client/              # Vue 3 Frontend
│       ├── src/
│       │   ├── main.js
│       │   ├── App.vue
│       │   ├── router.js
│       │   ├── stores/      # Pinia Stores
│       │   ├── composables/ # Vue Composables
│       │   ├── components/  # Vue Komponenten
│       │   └── views/       # Vue Ansichten
│       └── public/          # Statische Assets & Icons
```

## API-Endpunkte

### Authentifizierung (`/api/auth`)

- `POST /register` - Neuen Benutzer registrieren
- `POST /login` - Anmelden
- `POST /logout` - Abmelden
- `GET /me` - Aktuelle Session prüfen

### Arbeitsbereiche (`/api/workspaces`)

- `GET /` - Alle Arbeitsbereiche abrufen
- `POST /` - Neuen Arbeitsbereich erstellen
- `GET /:id` - Arbeitsbereich-Details
- `PATCH /:id` - Arbeitsbereich aktualisieren
- `DELETE /:id` - Arbeitsbereich löschen
- `POST /join` - Arbeitsbereich per Einladungscode beitreten
- `POST /:id/leave` - Arbeitsbereich verlassen

### Aufgaben (`/api/workspaces/:workspaceId/todos`)

- `GET /` - Alle Aufgaben abrufen
- `POST /` - Neue Aufgabe erstellen
- `PATCH /:id` - Aufgabe aktualisieren (inkl. abhaken)
- `DELETE /:id` - Aufgabe löschen

### Push-Benachrichtigungen (`/api/push`)

- `GET /vapid-public-key` - VAPID Public Key für Push
- `POST /subscribe` - Push-Subscription registrieren
- `DELETE /subscribe` - Push-Subscription entfernen

## Datenbankschema

- **users** - Benutzerkonten mit bcrypt-gehashten Passwörtern
- **workspaces** - Arbeitsbereiche mit Einladungscodes
- **workspace_members** - Many-to-Many Zuordnung (mit Rollen)
- **todos** - Aufgaben mit optionalen Erinnerungen
- **push_subscriptions** - Web Push Subscriptions pro Gerät
- **sessions** - Session-Store für express-session

## Entwicklung

### Verfügbare Scripts

```bash
# Alle Pakete gleichzeitig entwickeln
npm run dev

# Nur Backend
npm run dev:server

# Nur Frontend
npm run dev:client

# Frontend bauen
npm run build

# Produktions-Server starten
npm start
```

### Environment Variables

#### Server (`.env` in `packages/server/`)

```env
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-secret-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=mailto:your@email.com
```

**VAPID-Keys generieren:**
```bash
npx web-push generate-vapid-keys
```

#### Client (`.env` in `packages/client/`)

```env
VITE_API_BASE=/api
```

## Push-Benachrichtigungen

Die App unterstützt Web Push Notifications:

1. Klicken Sie auf das Glocken-Icon in der App
2. Erlauben Sie Benachrichtigungen im Browser
3. Sie erhalten Benachrichtigungen wenn:
   - Ein Teammitglied eine Aufgabe erledigt
   - Eine Ihrer Aufgaben fällig ist (Reminder)

## PWA Installation

Die App kann als PWA installiert werden:

- **Desktop**: Klicken Sie auf das Install-Icon in der Browser-Adressleiste
- **Mobile**: "Zum Startbildschirm hinzufügen" im Browser-Menü

## Offline-Funktionalität

- Statische Assets werden im Cache gespeichert
- API-Anfragen verwenden NetworkFirst-Strategie
- Offline-Indikator zeigt Verbindungsstatus

## Seed-Daten

Die Datenbank wird beim ersten Start mit folgenden Daten gefüllt:

**Admin-Benutzer:**
- E-Mail: `mail@michoest.com`
- Passwort: `admin`

**Beispiel-Arbeitsbereiche:**
1. Einkaufsliste (mit Beispiel-Aufgaben)
2. Hausarbeit (mit Beispiel-Aufgaben)
3. Projektideen (mit Beispiel-Aufgaben)

## Produktions-Deployment

1. **Environment-Variablen setzen:**
   - Generieren Sie sichere `SESSION_SECRET`
   - Setzen Sie `NODE_ENV=production`
   - Konfigurieren Sie `CLIENT_URL` für CORS

2. **Frontend bauen:**
   ```bash
   npm run build
   ```

3. **Server starten:**
   ```bash
   npm start
   ```

4. **Statische Dateien ausliefern:**
   Servieren Sie `packages/client/dist` über Ihren Webserver oder
   konfigurieren Sie Express, um die statischen Dateien zu servieren.

## Sicherheitshinweise

⚠️ **Vor Produktionseinsatz beachten:**

- Ändern Sie `SESSION_SECRET` in eine kryptographisch sichere Zufallszeichenfolge
- Generieren Sie neue VAPID-Keys
- Aktivieren Sie HTTPS (erforderlich für Service Worker & Push)
- Konfigurieren Sie CORS für Ihre Domain
- Implementieren Sie Rate Limiting
- Erwägen Sie Datenbankbackups

## Icons

Die App verwendet das Material Design Icon `checkbox-marked-circle-auto-outline` als Logo.
Icons sind als SVG-Dateien in `packages/client/public/` verfügbar:

- `icon-192.svg` / `icon-192.png` (192x192)
- `icon-512.svg` / `icon-512.png` (512x512)
- `favicon.ico`

Für Produktionseinsatz empfiehlt es sich, die SVGs in echte PNGs zu konvertieren.

## Lizenz

MIT

## Support

Bei Fragen oder Problemen öffnen Sie bitte ein Issue im Repository.

---

**Viel Spaß mit Ihrer kollaborativen Todo-App! 🚀**
