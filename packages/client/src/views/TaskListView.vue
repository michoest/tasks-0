<template>
  <v-main class="bg-background">
    <v-container fluid class="pa-0">
      <!-- Header with Space Selector -->
      <div class="list-header">
        <div class="header-row">
          <!-- Space Selector -->
          <v-menu>
            <template #activator="{ props }">
              <div class="selector-chip" v-bind="props">
                <v-icon size="18" :color="selectedSpace?.personal_color || 'primary'">mdi-folder</v-icon>
                <span>{{ selectedSpace?.personal_name || selectedSpace?.name || 'Space' }}</span>
                <v-icon size="16">mdi-chevron-down</v-icon>
              </div>
            </template>
            <v-list density="compact">
              <v-list-item
                v-for="space in spacesStore.spaces"
                :key="space.id"
                :active="selectedSpaceId === space.id"
                @click="selectSpace(space.id)"
              >
                <template #prepend>
                  <v-icon :color="space.personal_color || 'primary'" size="small">mdi-folder</v-icon>
                </template>
                <v-list-item-title>{{ space.personal_name || space.name }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>

        <!-- Category Tabs -->
        <v-tabs
          v-model="selectedTabIndex"
          density="default"
          class="category-tabs"
        >
          <v-tab :value="0" class="category-tab">
            <v-icon size="16" class="mr-1">mdi-tag-multiple</v-icon>
            Alle
            <v-badge
              v-if="getTaskCountForCategory(null) > 0"
              :content="getTaskCountForCategory(null)"
              color="grey"
              inline
              class="ml-1"
            />
          </v-tab>
          <v-tab
            v-for="(category, index) in categories"
            :key="category.id"
            :value="index + 1"
            class="category-tab"
          >
            <v-icon size="16" :color="category.color" :icon="category.icon || 'mdi-tag'" class="mr-1" />
            {{ category.name }}
            <v-badge
              v-if="getTaskCountForCategory(category.id) > 0"
              :content="getTaskCountForCategory(category.id)"
              :color="category.color"
              inline
              class="ml-1"
            />
          </v-tab>
        </v-tabs>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <!-- Swipeable Task Lists -->
      <v-window v-else v-model="selectedTabIndex" class="task-window">
        <!-- All Categories -->
        <v-window-item :value="0">
          <TaskListContent
            :tasks="getTasksForCategory(null)"
            :show-category="true"
            @task-click="openTaskSheet"
            @task-complete="completeTask"
          />
        </v-window-item>

        <!-- Per Category -->
        <v-window-item
          v-for="(category, index) in categories"
          :key="category.id"
          :value="index + 1"
        >
          <TaskListContent
            :tasks="getTasksForCategory(category.id)"
            :show-category="false"
            @task-click="openTaskSheet"
            @task-complete="completeTask"
          />
        </v-window-item>
      </v-window>

      <!-- FAB -->
      <v-btn
        icon="mdi-plus"
        color="primary"
        size="large"
        position="fixed"
        location="bottom end"
        class="mb-16 me-4"
        @pointerdown.prevent="openQuickAdd"
        @touchstart.prevent="openQuickAdd"
      />
    </v-container>

    <!-- Quick Add Sheet -->
    <QuickAddSheet
      ref="quickAddRef"
      v-model="quickAddSheet"
      :default-space-id="selectedSpaceId"
      @add-inbox="addToInbox"
      @open-full="openFullTaskDialog"
    />

    <!-- Task Dialog -->
    <TaskDialog
      ref="taskDialogRef"
      v-model="taskDialog"
      :task="editingTask"
      :categories="categories"
      :spaces="spacesStore.spaces"
      :default-space-id="selectedSpaceId"
      :initial-title="initialTitle"
      :initial-category-id="editingTask ? null : currentCategoryId"
      @save="saveTask"
    />

    <!-- Task Action Sheet -->
    <TaskActionSheet
      v-model="taskSheet"
      :task="selectedTask"
      :show-space-name="false"
      :show-history="false"
      @complete="completeTaskAndClose"
      @edit="editTask"
      @delete="deleteTask"
    />

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :timeout="2000" :color="snackbarColor" location="top">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSpacesStore } from '../stores/spaces.js';
import { api } from '../composables/useApi.js';
import TaskDialog from '../components/TaskDialog.vue';
import QuickAddSheet from '../components/QuickAddSheet.vue';
import TaskActionSheet from '../components/TaskActionSheet.vue';
import TaskListContent from '../components/TaskListContent.vue';

const spacesStore = useSpacesStore();

// State
const loading = ref(false);
const tasks = ref([]);
const categories = ref([]);
const selectedSpaceId = ref(null);
const selectedTabIndex = ref(0);

// Dialogs
const quickAddSheet = ref(false);
const taskDialog = ref(false);
const taskSheet = ref(false);
const selectedTask = ref(null);
const editingTask = ref(null);
const initialTitle = ref('');

// Refs for dialog components (for iOS keyboard focus)
const quickAddRef = ref(null);
const taskDialogRef = ref(null);

// Snackbar
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

// Computed
const selectedSpace = computed(() =>
  spacesStore.spaces.find(s => s.id === selectedSpaceId.value)
);

// Get current category ID from tab selection (null if "Alle" is selected)
const currentCategoryId = computed(() => {
  if (selectedTabIndex.value === 0) return null;
  const category = categories.value[selectedTabIndex.value - 1];
  return category?.id || null;
});

// Get active tasks sorted
const activeTasks = computed(() => {
  return tasks.value
    .filter(t => t.status === 'active')
    .sort((a, b) => {
      // Overdue tasks first
      if (a.is_overdue && !b.is_overdue) return -1;
      if (!a.is_overdue && b.is_overdue) return 1;

      // Then by date (nulls last)
      if (a.next_due_date && !b.next_due_date) return -1;
      if (!a.next_due_date && b.next_due_date) return 1;
      if (a.next_due_date && b.next_due_date) {
        const cmp = a.next_due_date.localeCompare(b.next_due_date);
        if (cmp !== 0) return cmp;
      }

      // Then by title
      return a.title.localeCompare(b.title);
    });
});

// Methods
function getTasksForCategory(categoryId) {
  if (categoryId === null) {
    return activeTasks.value;
  }
  return activeTasks.value.filter(t => t.category_id === categoryId);
}

function getTaskCountForCategory(categoryId) {
  return getTasksForCategory(categoryId).length;
}

function selectSpace(spaceId) {
  selectedSpaceId.value = spaceId;
  selectedTabIndex.value = 0;
  localStorage.setItem('tasklist-space', spaceId);
  localStorage.removeItem('tasklist-category');
  loadData();
}

// Watch tab changes to persist category selection
watch(selectedTabIndex, (newIndex) => {
  if (newIndex === 0) {
    localStorage.removeItem('tasklist-category');
  } else {
    const category = categories.value[newIndex - 1];
    if (category) {
      localStorage.setItem('tasklist-category', category.id);
    }
  }
});

async function loadData() {
  if (!selectedSpaceId.value) return;

  loading.value = true;
  try {
    const [tasksRes, categoriesRes] = await Promise.all([
      api.get(`/spaces/${selectedSpaceId.value}/tasks`),
      api.get(`/spaces/${selectedSpaceId.value}/categories`)
    ]);
    tasks.value = tasksRes.tasks;
    categories.value = categoriesRes.categories;
  } catch (error) {
    console.error('Failed to load data:', error);
  } finally {
    loading.value = false;
  }
}

function openQuickAdd() {
  // Open full task dialog directly with current category pre-selected
  initialTitle.value = '';
  editingTask.value = null;
  taskDialog.value = true;
  // Sync focus for iOS keyboard
  taskDialogRef.value?.focusInputNow?.();
}

function openFullTaskDialog(title) {
  initialTitle.value = title || '';
  editingTask.value = null;
  taskDialog.value = true;
  // Sync focus for iOS keyboard
  taskDialogRef.value?.focusInputNow?.();
}

async function addToInbox(data) {
  try {
    await api.post(`/spaces/${selectedSpaceId.value}/tasks`, {
      title: data.title,
      task_type: 'inbox'
    });
    await loadData();
    snackbarMessage.value = 'Zur Inbox hinzugefügt';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to add to inbox:', error);
    snackbarMessage.value = 'Fehler';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function saveTask(data) {
  try {
    if (editingTask.value) {
      await api.patch(`/spaces/${selectedSpaceId.value}/tasks/${editingTask.value.id}`, data);
      snackbarMessage.value = 'Aufgabe aktualisiert';
    } else {
      await api.post(`/spaces/${selectedSpaceId.value}/tasks`, data);
      snackbarMessage.value = 'Aufgabe erstellt';
    }
    await loadData();
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to save task:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function openTaskSheet(task) {
  selectedTask.value = task;
  taskSheet.value = true;
}

async function completeTask(task) {
  try {
    const idx = tasks.value.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], completing: true };
    }

    await new Promise(resolve => setTimeout(resolve, 300));
    await api.post(`/spaces/${selectedSpaceId.value}/tasks/${task.id}/complete`, {});
    await loadData();

    snackbarMessage.value = 'Erledigt';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to complete task:', error);
    snackbarMessage.value = 'Fehler';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function completeTaskAndClose() {
  await completeTask(selectedTask.value);
  taskSheet.value = false;
}

function editTask() {
  editingTask.value = selectedTask.value;
  initialTitle.value = '';
  taskSheet.value = false;
  taskDialog.value = true;
  // Sync focus for iOS keyboard
  taskDialogRef.value?.focusInputNow?.();
}

async function deleteTask() {
  if (!confirm(`"${selectedTask.value.title}" löschen?`)) return;

  try {
    await api.delete(`/spaces/${selectedSpaceId.value}/tasks/${selectedTask.value.id}`);
    await loadData();
    taskSheet.value = false;
    snackbarMessage.value = 'Gelöscht';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to delete task:', error);
    snackbarMessage.value = 'Fehler beim Löschen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

// Initialize
onMounted(async () => {
  await spacesStore.fetchSpaces();

  // Restore saved selection
  const savedSpace = localStorage.getItem('tasklist-space');
  const savedCategory = localStorage.getItem('tasklist-category');

  if (savedSpace && spacesStore.spaces.find(s => s.id === parseInt(savedSpace))) {
    selectedSpaceId.value = parseInt(savedSpace);
  } else if (spacesStore.spaces.length > 0) {
    selectedSpaceId.value = spacesStore.spaces[0].id;
  }

  await loadData();

  // Restore category tab after loading data (so we can validate against available categories)
  if (savedCategory) {
    const catId = parseInt(savedCategory);
    const catIndex = categories.value.findIndex(c => c.id === catId);
    if (catIndex !== -1) {
      selectedTabIndex.value = catIndex + 1; // +1 because "Alle" is at index 0
    }
  }
});
</script>

<style scoped>
.bg-background {
  background-color: #fafafa;
  min-height: 100vh;
}

/* Header */
.list-header {
  position: sticky;
  top: 0;
  background: white;
  border-bottom: 1px solid #f0f0f0;
  z-index: 10;
}

.header-row {
  padding: 12px 16px 8px;
}

.selector-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.selector-chip:hover {
  background: #eeeeee;
}

/* Category Tabs */
.category-tabs {
  border-top: 1px solid #f0f0f0;
}

.category-tab {
  text-transform: none !important;
  font-weight: 400;
  letter-spacing: normal;
  min-width: auto;
  padding: 0 12px;
}

.category-tab :deep(.v-badge__badge) {
  font-size: 11px;
  height: 18px;
  min-width: 18px;
  padding: 0 5px;
}

/* Task Window for swipe */
.task-window {
  min-height: calc(100vh - 120px);
}
</style>
