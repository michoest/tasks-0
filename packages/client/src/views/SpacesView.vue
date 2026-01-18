<template>
  <v-main class="bg-background">
    <v-container fluid class="pa-4">
      <div class="d-flex align-center mb-4">
        <h1 class="text-h5 font-weight-bold">Spaces</h1>
        <v-spacer />
        <v-btn color="primary" icon="mdi-plus" variant="text" @click="createDialog = true" />
        <v-btn color="primary" icon="mdi-folder-lock-open-outline" variant="text" @click="joinDialog = true" />
      </div>

      <v-row v-if="spacesStore.loading">
        <v-col cols="12" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
        </v-col>
      </v-row>

      <v-row v-else-if="spacesStore.spaces.length === 0">
        <v-col cols="12" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1">mdi-folder-open</v-icon>
          <div class="text-h6 mt-4">Keine Spaces</div>
          <div class="text-body-2 text-grey mt-2 mb-4">
            Erstellen Sie einen Space oder treten Sie einem bei
          </div>
          <v-btn color="primary" variant="text" prepend-icon="mdi-plus" @click="createDialog = true">
            Space erstellen
          </v-btn>
        </v-col>
      </v-row>

      <v-row v-else>
        <v-col cols="12">
          <v-card elevation="0">
            <v-list class="pa-0">
              <v-list-item
                v-for="(space, index) in spacesStore.spaces"
                :key="space.id"
                @click="openSpaceSettings(space)"
                class="px-4"
              >
                <template #prepend>
                  <div class="d-flex flex-column mr-2">
                    <v-btn
                      icon="mdi-chevron-up"
                      size="x-small"
                      variant="text"
                      :disabled="index === 0"
                      @click.stop="moveSpaceUp(index)"
                    />
                    <v-btn
                      icon="mdi-chevron-down"
                      size="x-small"
                      variant="text"
                      :disabled="index === spacesStore.spaces.length - 1"
                      @click.stop="moveSpaceDown(index)"
                    />
                  </div>
                  <v-icon
                    icon="mdi-folder"
                    :color="space.personal_color || 'primary'"
                    class="mr-2"
                  />
                </template>

                <v-list-item-title>{{ space.personal_name || space.name }}</v-list-item-title>
                <v-list-item-subtitle v-if="space.personal_name">{{ space.name }}</v-list-item-subtitle>

                <template #append>
                  <v-chip
                    v-if="space.role === 'owner'"
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="mr-2"
                  >
                    <v-icon icon="mdi-crown" size="x-small" start />
                    Inhaber
                  </v-chip>
                  <v-chip
                    v-else
                    size="x-small"
                    variant="outlined"
                    class="mr-2"
                  >
                    <v-icon icon="mdi-account" size="x-small" start />
                    Mitglied
                  </v-chip>
                  <v-btn
                    icon="mdi-dots-vertical"
                    variant="text"
                    size="small"
                    @click.stop="openSpaceMenu(space)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
      </v-row>

      <!-- Join Space FAB -->
      <!-- <v-btn
        icon="mdi-account-multiple-plus"
        color="secondary"
        size="large"
        position="fixed"
        location="bottom end"
        class="mb-16 me-4"
        @click="joinDialog = true"
      /> -->
    </v-container>

    <!-- Create Space Bottom Sheet -->
    <v-bottom-sheet v-model="createDialog">
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
          <v-btn variant="text" color="error" @click="createDialog = false">Abbrechen</v-btn>
          <v-spacer />
          <v-btn variant="text" color="primary" @click="createSpace">Erstellen</v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Join Space Bottom Sheet -->
    <v-bottom-sheet v-model="joinDialog">
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
          <v-btn variant="text" color="error" @click="joinDialog = false">Abbrechen</v-btn>
          <v-spacer />
          <v-btn variant="text" color="primary" @click="joinSpace">Beitreten</v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Space Menu Bottom Sheet -->
    <v-bottom-sheet v-model="spaceMenuSheet">
      <v-card v-if="selectedSpace" :title="selectedSpace.personal_name || selectedSpace.name">
        <template v-slot:prepend>
          <v-icon color="primary" icon="mdi-folder"></v-icon>
        </template>
<template v-slot:append>
          <v-btn icon="mdi-close" variant="text" @click="spaceMenuSheet = false" />
        </template>
        <!-- <v-card-title class="d-flex align-center">
          <span>{{ selectedSpace.personal_name || selectedSpace.name }}</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="spaceMenuSheet = false" />
        </v-card-title> -->
        <v-list>
          <v-list-item @click="openShareDialog(selectedSpace); spaceMenuSheet = false">
            <template #prepend>
              <v-icon icon="mdi-share-variant" />
            </template>
            <v-list-item-title>Teilen</v-list-item-title>
          </v-list-item>

          <v-list-item @click="spaceMenuSheet = false; confirmLeave(selectedSpace)">
            <template #prepend>
              <v-icon icon="mdi-exit-to-app" />
            </template>
            <v-list-item-title>Verlassen</v-list-item-title>
          </v-list-item>

          <v-list-item @click="spaceMenuSheet = false; confirmDelete(selectedSpace)">
            <template #prepend>
              <v-icon icon="mdi-delete" color="error" />
            </template>
            <v-list-item-title class="text-error">Löschen</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-bottom-sheet>

    <!-- Share Bottom Sheet -->
    <v-bottom-sheet v-model="shareDialog">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-qrcode" class="mr-2" />
          <span>Space teilen</span>
        </v-card-title>
        <v-card-text class="text-center">
          <div class="mb-4">
            <QrcodeVue
              v-if="selectedSpace?.invite_code"
              :value="selectedSpace.invite_code"
              :size="200"
              level="H"
              class="mx-auto"
            />
          </div>

          <p class="text-body-2 mb-2">Einladungscode:</p>
          <v-text-field
            :model-value="selectedSpace?.invite_code"
            readonly
            variant="outlined"
            append-inner-icon="mdi-content-copy"
            @click:append-inner="copyInviteCode"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="shareDialog = false">Schließen</v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Delete/Leave Dialogs -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Space löschen?</v-card-title>
        <v-card-text>
          Möchten Sie "{{ selectedSpace?.name }}" wirklich löschen?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">Abbrechen</v-btn>
          <v-btn variant="text" color="error" @click="deleteSpace">Löschen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="leaveDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Space verlassen?</v-card-title>
        <v-card-text>
          Möchten Sie "{{ selectedSpace?.name }}" wirklich verlassen?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="leaveDialog = false">Abbrechen</v-btn>
          <v-btn variant="text" color="error" @click="leaveSpace">Verlassen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success Snackbar -->
    <v-snackbar v-model="showSnackbar" :timeout="2000">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-main>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSpacesStore } from '../stores/spaces.js';
import { useEventBus } from '../composables/useEventBus.js';
import { api } from '../composables/useApi.js';
import QrcodeVue from 'qrcode.vue';

const router = useRouter();
const spacesStore = useSpacesStore();
const eventBus = useEventBus();

const createDialog = ref(false);
const joinDialog = ref(false);
const shareDialog = ref(false);
const deleteDialog = ref(false);
const leaveDialog = ref(false);
const spaceMenuSheet = ref(false);

const newSpaceName = ref('');
const inviteCode = ref('');
const selectedSpace = ref(null);

const showSnackbar = ref(false);
const snackbarMessage = ref('');

onMounted(async () => {
  await spacesStore.fetchSpaces();

  // Listen for create space events from app bar
  eventBus.on('spaces:create', () => {
    createDialog.value = true;
  });
});

async function createSpace() {
  if (!newSpaceName.value.trim()) return;

  try {
    await spacesStore.createSpace(newSpaceName.value);
    newSpaceName.value = '';
    createDialog.value = false;
  } catch (error) {
    console.error('Failed to create space:', error);
  }
}

async function joinSpace() {
  if (!inviteCode.value.trim()) return;

  try {
    await spacesStore.joinSpace(inviteCode.value);
    inviteCode.value = '';
    joinDialog.value = false;
  } catch (error) {
    console.error('Failed to join space:', error);
  }
}

function openSpaceMenu(space) {
  selectedSpace.value = space;
  spaceMenuSheet.value = true;
}

function openSpaceSettings(space) {
  router.push(`/spaces/${space.id}/settings`);
}

function openShareDialog(space) {
  selectedSpace.value = space;
  shareDialog.value = true;
}

function copyInviteCode() {
  navigator.clipboard.writeText(selectedSpace.value.invite_code);
  snackbarMessage.value = 'Code kopiert!';
  showSnackbar.value = true;
}

function confirmDelete(space) {
  selectedSpace.value = space;
  deleteDialog.value = true;
}

async function deleteSpace() {
  try {
    await spacesStore.deleteSpace(selectedSpace.value.id);
    deleteDialog.value = false;
  } catch (error) {
    console.error('Failed to delete space:', error);
  }
}

function confirmLeave(space) {
  selectedSpace.value = space;
  leaveDialog.value = true;
}

async function leaveSpace() {
  try {
    await spacesStore.leaveSpace(selectedSpace.value.id);
    leaveDialog.value = false;
  } catch (error) {
    console.error('Failed to leave space:', error);
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
    showSnackbar.value = true;
  }
}
</script>

<style scoped>
.bg-background {
  background-color: #F9FAFB;
}
</style>
