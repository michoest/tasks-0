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
import { ref, computed, onMounted } from 'vue';
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
