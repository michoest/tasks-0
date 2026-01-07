<template>
  <v-main class="bg-background">
    <v-container fluid class="pa-4">
      <h1 class="text-h5 font-weight-bold mb-4">Einstellungen</h1>

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
  </v-main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../composables/useApi.js';

const router = useRouter();
const authStore = useAuthStore();

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
  await refreshPushStatus();
});

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
