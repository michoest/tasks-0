<template>
  <v-main class="bg-background">
    <v-container fluid class="pa-4">
      <h1 class="text-h5 font-weight-bold mb-4">Einstellungen</h1>

      <!-- Spaces Section -->
      <v-card variant="outlined" class="mb-3">
        <v-card-title class="d-flex align-center">
          <span class="text-subtitle-1">Spaces</span>
          <v-spacer />
          <v-btn icon="mdi-plus" size="small" variant="text" @click="createSpaceDialog = true" />
          <v-btn icon="mdi-folder-lock-open-outline" size="small" variant="text" @click="joinSpaceDialog = true" />
        </v-card-title>
        <v-list class="pa-0" density="compact">
          <v-list-item
            v-for="(space, index) in spacesStore.spaces"
            :key="space.id"
            @click="router.push(`/spaces/${space.id}/settings`)"
          >
            <template #prepend>
              <div class="d-flex flex-column mr-1">
                <v-btn
                  icon="mdi-chevron-up"
                  size="x-small"
                  variant="text"
                  density="compact"
                  :disabled="index === 0"
                  @click.stop="moveSpaceUp(index)"
                />
                <v-btn
                  icon="mdi-chevron-down"
                  size="x-small"
                  variant="text"
                  density="compact"
                  :disabled="index === spacesStore.spaces.length - 1"
                  @click.stop="moveSpaceDown(index)"
                />
              </div>
              <v-icon
                icon="mdi-folder"
                :color="space.personal_color || 'primary'"
                size="small"
              />
            </template>

            <v-list-item-title class="text-body-2">{{ space.personal_name || space.name }}</v-list-item-title>

            <template #append>
              <v-chip
                v-if="space.role === 'owner'"
                size="x-small"
                color="primary"
                variant="tonal"
              >
                Inhaber
              </v-chip>
              <v-icon icon="mdi-chevron-right" size="small" class="ml-2" />
            </template>
          </v-list-item>
        </v-list>
        <v-card-text v-if="spacesStore.spaces.length === 0" class="text-center text-medium-emphasis">
          Keine Spaces vorhanden
        </v-card-text>
      </v-card>

      <v-card variant="outlined" class="mb-3">
        <v-card-title class="text-subtitle-1">Konto</v-card-title>
        <v-list class="pa-0">
          <v-list-item>
            <template #prepend>
              <v-avatar color="primary" size="48">
                <v-icon icon="mdi-account" size="24" />
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ fullName || 'Kein Name' }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ authStore.user?.email }}
            </v-list-item-subtitle>

            <template #append>
              <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEditDialog" />
            </template>
          </v-list-item>
        </v-list>
        <v-card-actions>
          <v-btn block variant="text" color="error" @click="confirmLogout">Abmelden</v-btn>
        </v-card-actions>
      </v-card>

      <v-card variant="outlined" class="mb-3">
        <v-card-title class="text-subtitle-1">Benachrichtigungen</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="settings.notification_time"
            label="Tägliche Benachrichtigungszeit"
            type="time"
            variant="outlined"
            density="compact"
            hide-details="auto"
            hint="Uhrzeit für tägliche Zusammenfassung"
            persistent-hint
            @blur="saveSettings"
            @change="saveSettings"
          />

          <v-select
            v-model="settings.digest_filter"
            :items="[
              { value: 'all', title: 'Alle Aufgaben' },
              { value: 'today_only', title: 'Nur heute fällige Aufgaben' },
              { value: 'overdue_and_today', title: 'Überfällige und heute fällige Aufgaben' }
            ]"
            label="Zusammenfassung anzeigen"
            variant="outlined"
            density="compact"
            hide-details
            class="mt-3"
            @update:model-value="saveSettings"
          />
        </v-card-text>
      </v-card>

      <!-- Advanced Settings (Collapsible) -->
      <v-expansion-panels class="mb-3">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <div class="d-flex align-center">
              <v-icon icon="mdi-cog" size="small" class="mr-2" />
              <span class="text-subtitle-1">Erweiterte Einstellungen</span>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <!-- Push Notification Debug -->
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="d-flex align-center">
                <span class="text-subtitle-1">Push-Benachrichtigungen</span>
                <v-spacer />
                <v-btn
                  icon="mdi-refresh"
                  size="small"
                  variant="text"
                  @click="refreshPushStatus"
                  :loading="pushLoading"
                />
              </v-card-title>
              <v-card-text>
                <v-list density="compact" class="pa-0">
                  <v-list-item>
                    <template #prepend>
                      <v-icon :icon="pushStatus.serviceWorker ? 'mdi-check-circle' : 'mdi-close-circle'" :color="pushStatus.serviceWorker ? 'success' : 'error'" />
                    </template>
                    <v-list-item-title>Service Worker</v-list-item-title>
                    <v-list-item-subtitle>{{ pushStatus.serviceWorkerDetails }}</v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template #prepend>
                      <v-icon :icon="pushStatus.notificationPermission === 'granted' ? 'mdi-check-circle' : (pushStatus.notificationPermission === 'denied' ? 'mdi-close-circle' : 'mdi-help-circle')" :color="pushStatus.notificationPermission === 'granted' ? 'success' : (pushStatus.notificationPermission === 'denied' ? 'error' : 'warning')" />
                    </template>
                    <v-list-item-title>Benachrichtigungs-Berechtigung</v-list-item-title>
                    <v-list-item-subtitle>{{ pushStatus.notificationPermission }}</v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template #prepend>
                      <v-icon :icon="pushStatus.pushSubscription ? 'mdi-check-circle' : 'mdi-close-circle'" :color="pushStatus.pushSubscription ? 'success' : 'error'" />
                    </template>
                    <v-list-item-title>Push-Abonnement</v-list-item-title>
                    <v-list-item-subtitle>{{ pushStatus.pushSubscriptionDetails }}</v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template #prepend>
                      <v-icon :icon="pushStatus.vapidKey ? 'mdi-check-circle' : 'mdi-close-circle'" :color="pushStatus.vapidKey ? 'success' : 'error'" />
                    </template>
                    <v-list-item-title>VAPID-Schlüssel</v-list-item-title>
                    <v-list-item-subtitle>{{ pushStatus.vapidKeyDetails }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>

                <v-divider class="my-3" />

                <div class="d-flex ga-2 flex-wrap">
                  <v-btn
                    v-if="pushStatus.notificationPermission !== 'granted'"
                    variant="outlined"
                    size="small"
                    @click="requestNotificationPermission"
                  >
                    Berechtigung anfragen
                  </v-btn>
                  <v-btn
                    v-if="pushStatus.notificationPermission === 'granted' && !pushStatus.pushSubscription"
                    variant="outlined"
                    size="small"
                    color="primary"
                    @click="subscribeToPush"
                    :loading="pushLoading"
                  >
                    Push aktivieren
                  </v-btn>
                  <v-btn
                    v-if="pushStatus.pushSubscription"
                    variant="outlined"
                    size="small"
                    color="error"
                    @click="unsubscribeFromPush"
                    :loading="pushLoading"
                  >
                    Push deaktivieren
                  </v-btn>
                  <v-btn
                    v-if="pushStatus.pushSubscription"
                    variant="outlined"
                    size="small"
                    @click="sendTestNotification"
                    :loading="testLoading"
                  >
                    Test senden
                  </v-btn>
                </div>

                <!-- Debug Log -->
                <v-expansion-panels class="mt-3">
                  <v-expansion-panel title="Debug-Log">
                    <v-expansion-panel-text>
                      <pre class="text-caption" style="white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto;">{{ pushDebugLog }}</pre>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </v-card-text>
            </v-card>

            <!-- API Key for External Integrations -->
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-1">API-Schlüssel</v-card-title>
              <v-card-text>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  Verwende diesen Schlüssel für externe Integrationen wie Apple Shortcuts, um Inbox-Einträge per Spracheingabe zu erstellen.
                </p>

                <div v-if="apiKey" class="d-flex align-center ga-2 mb-3">
                  <v-text-field
                    :model-value="showApiKey ? apiKey : '••••••••••••••••••••••••••••••••'"
                    readonly
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="flex-grow-1"
                  >
                    <template #append-inner>
                      <v-btn
                        :icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
                        variant="text"
                        size="small"
                        @click="showApiKey = !showApiKey"
                      />
                      <v-btn
                        icon="mdi-content-copy"
                        variant="text"
                        size="small"
                        @click="copyApiKey"
                      />
                    </template>
                  </v-text-field>
                </div>

                <div class="d-flex ga-2 flex-wrap">
                  <v-btn
                    v-if="!apiKey"
                    variant="outlined"
                    size="small"
                    color="primary"
                    @click="generateApiKey"
                    :loading="apiKeyLoading"
                  >
                    Schlüssel generieren
                  </v-btn>
                  <v-btn
                    v-if="apiKey"
                    variant="outlined"
                    size="small"
                    @click="generateApiKey"
                    :loading="apiKeyLoading"
                  >
                    Neu generieren
                  </v-btn>
                  <v-btn
                    v-if="apiKey"
                    variant="outlined"
                    size="small"
                    color="error"
                    @click="revokeApiKey"
                    :loading="apiKeyLoading"
                  >
                    Widerrufen
                  </v-btn>
                </div>

                <v-expansion-panels class="mt-3">
                  <v-expansion-panel title="Apple Shortcuts Anleitung">
                    <v-expansion-panel-text>
                      <ol class="text-body-2">
                        <li class="mb-2">Erstelle einen neuen Shortcut in der Shortcuts-App</li>
                        <li class="mb-2">Füge die Aktion "Text diktieren" hinzu</li>
                        <li class="mb-2">Füge "URL-Inhalt abrufen" hinzu mit:
                          <ul class="mt-1">
                            <li>URL: <code>{{ apiBaseUrl }}/api/inbox</code></li>
                            <li>Methode: POST</li>
                            <li>Body: JSON mit <code>transcript</code>, <code>space_id</code>, <code>api_key</code></li>
                          </ul>
                        </li>
                      </ol>
                      <v-alert type="info" density="compact" class="mt-2">
                        Space-ID findest du in den Space-Einstellungen
                      </v-alert>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </v-card-text>
            </v-card>

            <!-- Build Info -->
            <v-card variant="flat" class="bg-grey-lighten-4">
              <v-card-text class="text-center text-caption text-medium-emphasis">
                <div>Build: {{ buildTime }} ({{ buildTimeAgo }})</div>
              </v-card-text>
            </v-card>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="2000">
        {{ snackbarMessage }}
      </v-snackbar>
    </v-container>

    <!-- Edit Profile Dialog -->
    <v-dialog v-model="editDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Profil bearbeiten</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editForm.first_name"
            label="Vorname"
            variant="outlined"
            density="compact"
            hide-details
            class="mb-3"
          />
          <v-text-field
            v-model="editForm.last_name"
            label="Nachname"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="editDialog = false">Abbrechen</v-btn>
          <v-spacer />
          <v-btn variant="text" color="primary" @click="saveProfile">Speichern</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Logout Confirmation -->
    <v-dialog v-model="logoutDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Abmelden?</v-card-title>
        <v-card-text>
          Möchten Sie sich wirklich abmelden?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="logoutDialog = false">Abbrechen</v-btn>
          <v-btn variant="text" color="error" @click="handleLogout">Abmelden</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Create Space Dialog -->
    <v-bottom-sheet v-model="createSpaceDialog">
      <v-card>
        <v-card-title>Neuer Space</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newSpaceName"
            label="Name"
            variant="outlined"
            autofocus
            @keyup.enter="createSpace"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="createSpaceDialog = false">Abbrechen</v-btn>
          <v-spacer />
          <v-btn variant="text" color="primary" @click="createSpace">Erstellen</v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Join Space Dialog -->
    <v-bottom-sheet v-model="joinSpaceDialog">
      <v-card>
        <v-card-title>Space beitreten</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="inviteCode"
            label="Einladungscode"
            variant="outlined"
            autofocus
            @keyup.enter="joinSpace"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="joinSpaceDialog = false">Abbrechen</v-btn>
          <v-spacer />
          <v-btn variant="text" color="primary" @click="joinSpace">Beitreten</v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>
  </v-main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { api } from '../composables/useApi.js';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/de';

dayjs.extend(relativeTime);
dayjs.locale('de');

const router = useRouter();
const authStore = useAuthStore();
const spacesStore = useSpacesStore();

const settings = ref({
  notification_time: '09:00',
  digest_filter: 'overdue_and_today'
});

const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');
const logoutDialog = ref(false);
const editDialog = ref(false);
const editForm = ref({
  first_name: '',
  last_name: ''
});

// Space management state
const createSpaceDialog = ref(false);
const joinSpaceDialog = ref(false);
const newSpaceName = ref('');
const inviteCode = ref('');

// API key state
const apiKey = ref(null);
const showApiKey = ref(false);
const apiKeyLoading = ref(false);
const apiBaseUrl = computed(() => {
  // Get base URL for API (remove /api suffix if present)
  return window.location.origin;
});

// Build time injected at build
const buildTime = __BUILD_TIME__;
const buildTimestamp = __BUILD_TIMESTAMP__;
const buildTimeAgo = computed(() => dayjs(buildTimestamp).fromNow());

// Push notification debug state
const pushLoading = ref(false);
const testLoading = ref(false);
const pushDebugLog = ref('');
const pushStatus = reactive({
  serviceWorker: false,
  serviceWorkerDetails: 'Prüfung...',
  notificationPermission: 'default',
  pushSubscription: false,
  pushSubscriptionDetails: 'Prüfung...',
  vapidKey: false,
  vapidKeyDetails: 'Prüfung...'
});

function addLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  pushDebugLog.value = `[${timestamp}] ${message}\n${pushDebugLog.value}`;
}

async function refreshPushStatus() {
  pushLoading.value = true;
  pushDebugLog.value = '';
  addLog('Starte Status-Prüfung...');

  try {
    // Check Service Worker
    if ('serviceWorker' in navigator) {
      addLog('Service Worker API verfügbar');
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        pushStatus.serviceWorker = true;
        pushStatus.serviceWorkerDetails = `Aktiv (Scope: ${registration.scope})`;
        addLog(`Service Worker registriert: ${registration.scope}`);
        addLog(`SW State: ${registration.active?.state || 'unbekannt'}`);
      } else {
        pushStatus.serviceWorker = false;
        pushStatus.serviceWorkerDetails = 'Nicht registriert';
        addLog('Kein Service Worker registriert');
      }
    } else {
      pushStatus.serviceWorker = false;
      pushStatus.serviceWorkerDetails = 'Nicht unterstützt';
      addLog('Service Worker nicht unterstützt');
    }

    // Check Notification Permission
    if ('Notification' in window) {
      pushStatus.notificationPermission = Notification.permission;
      addLog(`Benachrichtigungs-Berechtigung: ${Notification.permission}`);
    } else {
      pushStatus.notificationPermission = 'nicht unterstützt';
      addLog('Notification API nicht unterstützt');
    }

    // Check Push Subscription
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      addLog('PushManager API verfügbar');
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          pushStatus.pushSubscription = true;
          pushStatus.pushSubscriptionDetails = `Aktiv (Endpoint: ${subscription.endpoint.substring(0, 50)}...)`;
          addLog(`Push-Abonnement aktiv`);
          addLog(`Endpoint: ${subscription.endpoint}`);
        } else {
          pushStatus.pushSubscription = false;
          pushStatus.pushSubscriptionDetails = 'Nicht abonniert';
          addLog('Kein Push-Abonnement vorhanden');
        }
      }
    } else {
      pushStatus.pushSubscription = false;
      pushStatus.pushSubscriptionDetails = 'Nicht unterstützt';
      addLog('PushManager nicht unterstützt');
    }

    // Check VAPID Key
    try {
      const res = await api.get('/push/vapid-public-key');
      if (res.vapidPublicKey) {
        pushStatus.vapidKey = true;
        pushStatus.vapidKeyDetails = `Verfügbar (${res.vapidPublicKey.substring(0, 20)}...)`;
        addLog(`VAPID-Schlüssel vom Server erhalten`);
      } else {
        pushStatus.vapidKey = false;
        pushStatus.vapidKeyDetails = 'Nicht konfiguriert';
        addLog('VAPID-Schlüssel nicht konfiguriert');
      }
    } catch (error) {
      pushStatus.vapidKey = false;
      pushStatus.vapidKeyDetails = `Fehler: ${error.message}`;
      addLog(`VAPID-Fehler: ${error.message}`);
    }

    addLog('Status-Prüfung abgeschlossen');
  } catch (error) {
    addLog(`Fehler: ${error.message}`);
  } finally {
    pushLoading.value = false;
  }
}

async function requestNotificationPermission() {
  addLog('Fordere Benachrichtigungs-Berechtigung an...');
  try {
    const permission = await Notification.requestPermission();
    pushStatus.notificationPermission = permission;
    addLog(`Berechtigung: ${permission}`);
    if (permission === 'granted') {
      snackbarMessage.value = 'Berechtigung erteilt';
      snackbarColor.value = 'success';
    } else {
      snackbarMessage.value = 'Berechtigung verweigert';
      snackbarColor.value = 'warning';
    }
    showSnackbar.value = true;
  } catch (error) {
    addLog(`Fehler: ${error.message}`);
    snackbarMessage.value = 'Fehler beim Anfordern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function subscribeToPush() {
  pushLoading.value = true;
  addLog('Starte Push-Abonnement...');

  try {
    // Get VAPID key
    const { vapidPublicKey } = await api.get('/push/vapid-public-key');
    addLog(`VAPID-Schlüssel erhalten`);

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    addLog('Service Worker bereit');

    // Convert VAPID key
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    addLog('Push-Abonnement erstellt');
    addLog(`Endpoint: ${subscription.endpoint}`);

    // Send to server
    await api.post('/push/subscribe', subscription.toJSON());
    addLog('Abonnement an Server gesendet');

    await refreshPushStatus();

    snackbarMessage.value = 'Push aktiviert';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    addLog(`Fehler: ${error.message}`);
    snackbarMessage.value = 'Fehler beim Aktivieren';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  } finally {
    pushLoading.value = false;
  }
}

async function unsubscribeFromPush() {
  pushLoading.value = true;
  addLog('Deaktiviere Push...');

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Unsubscribe locally
        await subscription.unsubscribe();
        addLog('Lokal abgemeldet');

        // Remove from server
        await api.delete('/push/subscribe');
        addLog('Vom Server entfernt');
      }
    }

    await refreshPushStatus();

    snackbarMessage.value = 'Push deaktiviert';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    addLog(`Fehler: ${error.message}`);
    snackbarMessage.value = 'Fehler beim Deaktivieren';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  } finally {
    pushLoading.value = false;
  }
}

async function sendTestNotification() {
  testLoading.value = true;
  addLog('Sende Test-Benachrichtigung...');

  try {
    await api.post('/push/test');
    addLog('Test-Benachrichtigung gesendet');
    snackbarMessage.value = 'Test gesendet';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    addLog(`Fehler: ${error.message}`);
    snackbarMessage.value = 'Fehler beim Senden';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  } finally {
    testLoading.value = false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const fullName = computed(() => {
  const first = authStore.user?.first_name || '';
  const last = authStore.user?.last_name || '';
  return [first, last].filter(Boolean).join(' ');
});

onMounted(async () => {
  if (authStore.user) {
    settings.value.notification_time = authStore.user.notification_time || '09:00';
    settings.value.digest_filter = authStore.user.digest_filter || 'overdue_and_today';
  }
  await spacesStore.fetchSpaces();
  await refreshPushStatus();
  await fetchApiKey();
});

async function fetchApiKey() {
  try {
    const res = await api.get('/users/api-key');
    apiKey.value = res.api_key;
  } catch (error) {
    console.error('Failed to fetch API key:', error);
  }
}

async function generateApiKey() {
  apiKeyLoading.value = true;
  try {
    const res = await api.post('/users/api-key');
    apiKey.value = res.api_key;
    showApiKey.value = true;
    snackbarMessage.value = 'API-Schlüssel generiert';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to generate API key:', error);
    snackbarMessage.value = 'Fehler beim Generieren';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  } finally {
    apiKeyLoading.value = false;
  }
}

async function revokeApiKey() {
  apiKeyLoading.value = true;
  try {
    await api.delete('/users/api-key');
    apiKey.value = null;
    showApiKey.value = false;
    snackbarMessage.value = 'API-Schlüssel widerrufen';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    snackbarMessage.value = 'Fehler beim Widerrufen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  } finally {
    apiKeyLoading.value = false;
  }
}

async function copyApiKey() {
  if (apiKey.value) {
    try {
      await navigator.clipboard.writeText(apiKey.value);
      snackbarMessage.value = 'Kopiert!';
      snackbarColor.value = 'success';
      showSnackbar.value = true;
    } catch (error) {
      snackbarMessage.value = 'Kopieren fehlgeschlagen';
      snackbarColor.value = 'error';
      showSnackbar.value = true;
    }
  }
}

async function saveSettings() {
  try {
    const res = await api.patch('/users/settings', settings.value);
    authStore.user = res.user;

    snackbarMessage.value = 'Einstellungen gespeichert';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function openEditDialog() {
  editForm.value.first_name = authStore.user?.first_name || '';
  editForm.value.last_name = authStore.user?.last_name || '';
  editDialog.value = true;
}

async function saveProfile() {
  try {
    const res = await api.patch('/users/settings', {
      first_name: editForm.value.first_name,
      last_name: editForm.value.last_name
    });
    authStore.user = res.user;
    editDialog.value = false;

    snackbarMessage.value = 'Profil gespeichert';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to save profile:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

// Space management functions
async function createSpace() {
  if (!newSpaceName.value.trim()) return;

  try {
    await spacesStore.createSpace(newSpaceName.value);
    newSpaceName.value = '';
    createSpaceDialog.value = false;
    snackbarMessage.value = 'Space erstellt';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to create space:', error);
    snackbarMessage.value = 'Fehler beim Erstellen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function joinSpace() {
  if (!inviteCode.value.trim()) return;

  try {
    await spacesStore.joinSpace(inviteCode.value);
    inviteCode.value = '';
    joinSpaceDialog.value = false;
    snackbarMessage.value = 'Space beigetreten';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to join space:', error);
    snackbarMessage.value = 'Fehler beim Beitreten';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function moveSpaceUp(index) {
  if (index === 0) return;
  const newOrder = [...spacesStore.spaces];
  [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
  spacesStore.spaces = newOrder;
  await saveSpaceOrder();
}

async function moveSpaceDown(index) {
  if (index === spacesStore.spaces.length - 1) return;
  const newOrder = [...spacesStore.spaces];
  [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
  spacesStore.spaces = newOrder;
  await saveSpaceOrder();
}

async function saveSpaceOrder() {
  try {
    const space_ids = spacesStore.spaces.map(s => s.id);
    await api.post('/spaces/reorder', { space_ids });
  } catch (error) {
    console.error('Failed to save space order:', error);
    snackbarMessage.value = 'Fehler beim Speichern der Reihenfolge';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function confirmLogout() {
  logoutDialog.value = true;
}

async function handleLogout() {
  logoutDialog.value = false;
  await authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.bg-background {
  background-color: #F9FAFB;
}
</style>
