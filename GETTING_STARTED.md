# Getting Started

Schnellanleitung zum Starten der Collaborative To-Do App.

## 1. Erste Schritte

```bash
# Im Projektverzeichnis
cd /Users/michoest/dev/foundations/mobile-0

# App starten (Backend + Frontend gleichzeitig)
npm run dev
```

Die App ist jetzt erreichbar unter:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api

## 2. Anmelden

Verwenden Sie den voreingestellten Admin-Account:

- **E-Mail**: `mail@michoest.com`
- **Passwort**: `admin`

## 3. Funktionen ausprobieren

### Arbeitsbereiche
- ✅ Es gibt bereits 3 Beispiel-Arbeitsbereiche: "Einkaufsliste", "Hausarbeit" und "Projektideen"
- ✅ Klicken Sie auf "Neuer Arbeitsbereich" um einen eigenen zu erstellen
- ✅ Teilen Sie Arbeitsbereiche über den "Teilen"-Button (Einladungscode)

### Aufgaben
- ✅ Öffnen Sie einen Arbeitsbereich
- ✅ Fügen Sie neue Aufgaben hinzu
- ✅ Haken Sie Aufgaben ab (sendet Benachrichtigungen an Teammitglieder!)
- ✅ Fügen Sie Aufgaben mit Erinnerungen hinzu (Datum/Zeit)

### Push-Benachrichtigungen
1. Klicken Sie auf das **Glocken-Icon** oben rechts
2. Erlauben Sie Benachrichtigungen im Browser
3. Haken Sie eine Aufgabe ab → Andere Teammitglieder werden benachrichtigt
4. Erinnerungen werden zur eingestellten Zeit gesendet

### PWA Installation
- **Desktop**: Klicken Sie auf das Install-Icon in der Adressleiste
- **Mobile**: Wählen Sie "Zum Startbildschirm hinzufügen" im Menü

## 4. Kollaboration testen

Um die Kollaborationsfunktionen zu testen:

1. Erstellen Sie einen neuen Arbeitsbereich
2. Klicken Sie auf "Teilen" und kopieren Sie den Einladungscode
3. Öffnen Sie die App in einem **Inkognito-/Privat-Fenster**
4. Registrieren Sie einen zweiten Benutzer
5. Klicken Sie auf "Beitreten" und geben Sie den Einladungscode ein
6. Jetzt können beide Benutzer Aufgaben sehen und bearbeiten!

## 5. Entwicklung

### Server neu starten
```bash
npm run dev:server
```

### Client neu starten
```bash
npm run dev:client
```

### Nur Backend testen
```bash
# API-Endpunkt testen
curl http://localhost:3000/api/health
```

### Logs anschauen
- Server-Logs werden in der Konsole angezeigt (Request-Logging aktiviert)
- Browser-Konsole öffnen (F12) für Client-Logs

## 6. Datenbank zurücksetzen

Falls Sie mit frischen Daten neu starten möchten:

```bash
# Datenbank löschen
rm packages/server/data/todos.db

# App neu starten (erstellt DB automatisch neu)
npm run dev:server
```

## 7. Häufige Probleme

### Port bereits in Verwendung
Falls Port 3000 oder 5173 bereits belegt ist:

```bash
# Server-Port ändern
# In packages/server/.env: PORT=3001

# Client-Proxy anpassen
# In packages/client/vite.config.js: proxy target ändern
```

### Push-Benachrichtigungen funktionieren nicht
- Prüfen Sie ob HTTPS verwendet wird (erforderlich in Produktion)
- Prüfen Sie ob die VAPID-Keys in `.env` gesetzt sind
- Schauen Sie in die Browser-Konsole für Fehler

### Datenbank-Fehler
- Stellen Sie sicher, dass der `data/` Ordner beschreibbar ist
- Löschen Sie die DB-Datei und lassen Sie sie neu erstellen

## 8. Nächste Schritte

- 📖 Lesen Sie die vollständige [README.md](README.md) für Details
- 🔧 Schauen Sie sich die [SPECIFICATION.md](SPECIFICATION.md) an
- 🚀 Deployen Sie die App (siehe README.md "Produktions-Deployment")

---

**Viel Erfolg! 🎉**
