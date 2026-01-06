<template>
  <v-main class="bg-background">
    <v-container fluid class="pa-4">
      <!-- Header with back button -->
      <div class="d-flex align-center mb-4">
        <v-btn icon="mdi-arrow-left" variant="text" @click="router.back()" />
        <h1 class="text-h5 font-weight-bold ml-2">{{ space?.name }}</h1>
      </div>

      <v-row v-if="loading">
        <v-col cols="12" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
        </v-col>
      </v-row>

      <template v-else-if="space">
        <!-- Space-wide Settings Section (Owner only) -->
        <div v-if="isOwner" class="mb-6">
          <h2 class="text-h6 font-weight-bold mb-3">Space-Einstellungen</h2>
          <v-card elevation="0">
            <v-card-text>
              <v-text-field
                v-model="spaceName"
                label="Space-Name"
                variant="outlined"
                hide-details
                @blur="saveSpaceName"
                @keyup.enter="saveSpaceName"
              />
            </v-card-text>
          </v-card>
        </div>

        <!-- Categories Section (Owner only) -->
        <div v-if="isOwner" class="mb-6">
          <div class="d-flex align-center mb-3">
            <h2 class="text-h6 font-weight-bold">Kategorien</h2>
            <v-spacer />
            <v-btn
              icon="mdi-plus"
              size="small"
              variant="text"
              color="primary"
              @click="openCreateCategoryDialog"
            />
          </div>

          <v-card elevation="0" v-if="categories.length > 0">
            <v-list class="pa-0">
              <v-list-item
                v-for="(category, index) in categories"
                :key="category.id"
                class="px-4"
              >
                <template #prepend>
                  <div class="d-flex flex-column mr-2">
                    <v-btn
                      icon="mdi-chevron-up"
                      size="x-small"
                      variant="text"
                      :disabled="index === 0"
                      @click="moveCategoryUp(index)"
                    />
                    <v-btn
                      icon="mdi-chevron-down"
                      size="x-small"
                      variant="text"
                      :disabled="index === categories.length - 1"
                      @click="moveCategoryDown(index)"
                    />
                  </div>
                  <v-icon :icon="category.icon" :color="category.color" class="mr-2" />
                </template>

                <v-list-item-title>{{ category.name }}</v-list-item-title>

                <template #append>
                  <v-btn
                    icon="mdi-pencil"
                    variant="text"
                    size="small"
                    @click="editCategory(category)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    size="small"
                    color="error"
                    @click="confirmDeleteCategory(category)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-card>

          <v-card elevation="0" v-else>
            <v-card-text class="text-center py-8">
              <v-icon size="48" color="grey-lighten-1">mdi-tag-off-outline</v-icon>
              <div class="text-body-2 text-medium-emphasis mt-2">
                Keine Kategorien
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- User-specific Settings Section -->
        <div class="mb-6">
          <h2 class="text-h6 font-weight-bold mb-3">Persönliche Einstellungen</h2>
          <v-card elevation="0">
            <v-card-text>
              <v-text-field
                v-model="personalName"
                label="Eigener Name für diesen Space"
                variant="outlined"
                hint="Nur für dich sichtbar. Leer lassen für Standardname."
                persistent-hint
                class="mb-4"
                @blur="savePersonalSettings"
                @keyup.enter="savePersonalSettings"
              />

              <div class="text-caption mb-2">Space-Farbe (nur für dich)</div>
              <div class="d-flex flex-wrap ga-2 mb-2">
                <v-chip
                  v-for="color in availableColors"
                  :key="color"
                  :color="color"
                  :variant="personalColor === color ? 'flat' : 'outlined'"
                  size="small"
                  @click="setPersonalColor(color)"
                />
                <v-menu :close-on-content-click="false">
                  <template #activator="{ props }">
                    <v-chip
                      v-bind="props"
                      size="small"
                      :variant="customPersonalColor ? 'flat' : 'outlined'"
                      :style="customPersonalColor ? { backgroundColor: customPersonalColor } : {}"
                    >
                      <v-icon icon="mdi-palette" size="small" />
                    </v-chip>
                  </template>
                  <v-color-picker
                    v-model="customPersonalColor"
                    mode="hex"
                    hide-inputs
                    show-swatches
                    @update:model-value="savePersonalSettings"
                  />
                </v-menu>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </template>
    </v-container>

    <!-- Category Create/Edit Dialog -->
    <v-bottom-sheet v-model="categoryDialog">
      <v-card>
        <v-card-title>{{ editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="categoryForm.name"
            label="Name"
            variant="outlined"
            class="mb-3"
          />

          <div class="mb-3">
            <div class="text-caption mb-2">Icon</div>
            <v-chip-group v-model="categoryForm.icon" column mandatory>
              <v-chip v-for="icon in availableIcons" :key="icon" :value="icon" variant="outlined" filter>
                <v-icon :icon="icon" />
              </v-chip>
            </v-chip-group>
            <v-text-field
              v-model="customIcon"
              label="Eigenes Icon"
              variant="outlined"
              density="compact"
              hide-details
              class="mt-2"
              placeholder="home, cart, star..."
            >
              <template #prepend-inner>
                <span class="text-caption text-medium-emphasis">mdi-</span>
              </template>
              <template #append-inner>
                <v-icon v-if="customIcon" :icon="'mdi-' + customIcon" />
              </template>
            </v-text-field>
          </div>

          <div class="mb-3">
            <div class="text-caption mb-2">Farbe</div>
            <div class="d-flex flex-wrap ga-2">
              <v-chip
                v-for="color in availableColors"
                :key="color"
                :color="color"
                :variant="categoryForm.color === color ? 'flat' : 'outlined'"
                size="small"
                @click="categoryForm.color = color; customColor = ''"
              />
              <v-menu :close-on-content-click="false">
                <template #activator="{ props }">
                  <v-chip
                    v-bind="props"
                    size="small"
                    :variant="customColor ? 'flat' : 'outlined'"
                    :style="customColor ? { backgroundColor: customColor } : {}"
                  >
                    <v-icon icon="mdi-palette" size="small" />
                  </v-chip>
                </template>
                <v-color-picker
                  v-model="customColor"
                  mode="hex"
                  hide-inputs
                  show-swatches
                />
              </v-menu>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" color="error" @click="categoryDialog = false">Abbrechen</v-btn>
          <v-spacer />
          <v-btn variant="text" color="primary" @click="saveCategory">
            {{ editingCategory ? 'Speichern' : 'Erstellen' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Delete Category Confirmation -->
    <v-dialog v-model="deleteCategoryDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Kategorie löschen?</v-card-title>
        <v-card-text>
          Möchten Sie "{{ categoryToDelete?.name }}" wirklich löschen?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteCategoryDialog = false">Abbrechen</v-btn>
          <v-btn variant="text" color="error" @click="deleteCategory">Löschen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar
      v-model="showSnackbar"
      :timeout="2000"
      :color="snackbarColor"
      location="top"
    >
      {{ snackbarMessage }}
    </v-snackbar>
  </v-main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../composables/useApi.js';

const router = useRouter();
const route = useRoute();
const spaceId = route.params.id;

const loading = ref(true);
const space = ref(null);
const categories = ref([]);
const spaceName = ref('');
const personalName = ref('');
const personalColor = ref('');
const customPersonalColor = ref('');

const categoryDialog = ref(false);
const deleteCategoryDialog = ref(false);
const editingCategory = ref(null);
const categoryToDelete = ref(null);

const categoryForm = ref({
  name: '',
  icon: 'mdi-tag',
  color: 'blue'
});
const customIcon = ref('');
const customColor = ref('');

const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

// Check if current user is owner
const isOwner = computed(() => {
  return space.value?.role === 'owner';
});

const availableIcons = [
  'mdi-tag',
  'mdi-home',
  'mdi-cart',
  'mdi-food',
  'mdi-car',
  'mdi-wrench',
  'mdi-school',
  'mdi-heart',
  'mdi-leaf',
  'mdi-dumbbell',
  'mdi-book',
  'mdi-briefcase'
];

const availableColors = [
  'red',
  'pink',
  'purple',
  'deep-purple',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'green',
  'light-green',
  'amber',
  'orange',
  'deep-orange',
  'brown',
  'grey'
];

// Watch custom icon and apply it
watch(customIcon, (newVal) => {
  if (newVal) {
    categoryForm.value.icon = 'mdi-' + newVal;
  }
});

// Watch custom color and apply it
watch(customColor, (newVal) => {
  if (newVal) {
    categoryForm.value.color = newVal;
  }
});

onMounted(async () => {
  await loadSpace();
  await loadCategories();
  loading.value = false;
});

async function loadSpace() {
  try {
    const res = await api.get(`/spaces/${spaceId}`);
    space.value = res.space;
    spaceName.value = res.space.name;
    // Load personal settings if they exist
    personalName.value = res.space.personal_name || '';
    personalColor.value = res.space.personal_color || '';
    if (personalColor.value && personalColor.value.startsWith('#')) {
      customPersonalColor.value = personalColor.value;
    }
  } catch (error) {
    console.error('Failed to load space:', error);
  }
}

async function loadCategories() {
  try {
    const res = await api.get(`/spaces/${spaceId}/categories`);
    categories.value = res.categories;
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

async function saveSpaceName() {
  if (!spaceName.value.trim() || spaceName.value === space.value.name) return;

  try {
    await api.patch(`/spaces/${spaceId}`, { name: spaceName.value.trim() });
    space.value.name = spaceName.value.trim();
    snackbarMessage.value = 'Name gespeichert';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to save space name:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function openCreateCategoryDialog() {
  editingCategory.value = null;
  categoryForm.value = {
    name: '',
    icon: 'mdi-tag',
    color: 'blue'
  };
  customIcon.value = '';
  customColor.value = '';
  categoryDialog.value = true;
}

function editCategory(category) {
  editingCategory.value = category;
  categoryForm.value = {
    name: category.name,
    icon: category.icon,
    color: category.color
  };
  // Check if it's a custom icon
  if (category.icon && !availableIcons.includes(category.icon)) {
    customIcon.value = category.icon.replace('mdi-', '');
  } else {
    customIcon.value = '';
  }
  // Check if it's a custom color
  if (category.color && !availableColors.includes(category.color)) {
    customColor.value = category.color;
  } else {
    customColor.value = '';
  }
  categoryDialog.value = true;
}

async function saveCategory() {
  try {
    if (editingCategory.value) {
      await api.patch(`/spaces/${spaceId}/categories/${editingCategory.value.id}`, categoryForm.value);
      snackbarMessage.value = 'Kategorie aktualisiert';
    } else {
      await api.post(`/spaces/${spaceId}/categories`, categoryForm.value);
      snackbarMessage.value = 'Kategorie erstellt';
    }
    snackbarColor.value = 'success';
    showSnackbar.value = true;
    categoryDialog.value = false;
    await loadCategories();
  } catch (error) {
    console.error('Failed to save category:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function confirmDeleteCategory(category) {
  categoryToDelete.value = category;
  deleteCategoryDialog.value = true;
}

async function deleteCategory() {
  try {
    await api.delete(`/spaces/${spaceId}/categories/${categoryToDelete.value.id}`);
    snackbarMessage.value = 'Kategorie gelöscht';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
    deleteCategoryDialog.value = false;
    await loadCategories();
  } catch (error) {
    console.error('Failed to delete category:', error);
    snackbarMessage.value = 'Fehler beim Löschen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function moveCategoryUp(index) {
  if (index === 0) return;
  const newOrder = [...categories.value];
  [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
  categories.value = newOrder;
  await saveCategoryOrder();
}

async function moveCategoryDown(index) {
  if (index === categories.value.length - 1) return;
  const newOrder = [...categories.value];
  [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
  categories.value = newOrder;
  await saveCategoryOrder();
}

async function saveCategoryOrder() {
  try {
    const category_ids = categories.value.map(c => c.id);
    await api.post(`/spaces/${spaceId}/categories/reorder`, { category_ids });
  } catch (error) {
    console.error('Failed to save category order:', error);
    snackbarMessage.value = 'Fehler beim Speichern der Reihenfolge';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function setPersonalColor(color) {
  personalColor.value = color;
  customPersonalColor.value = '';
  savePersonalSettings();
}

async function savePersonalSettings() {
  try {
    const colorToSave = customPersonalColor.value || personalColor.value || null;
    await api.patch(`/spaces/${spaceId}/personal-settings`, {
      personal_name: personalName.value || null,
      personal_color: colorToSave
    });
    snackbarMessage.value = 'Einstellungen gespeichert';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to save personal settings:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}
</script>

<style scoped>
.bg-background {
  background-color: #F9FAFB;
}

.color-preview {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
