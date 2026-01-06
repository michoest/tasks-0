<template>
  <v-app>
    <!-- Compact App Bar -->
    <v-app-bar color="primary" density="compact">
      <v-btn icon="mdi-arrow-left" @click="goBack" />
      <v-app-bar-title class="text-h6">{{ spacesStore.currentSpace?.name || 'Laden...' }}</v-app-bar-title>
      <v-btn icon="mdi-cog" @click="settingsSheet = true" />
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-2">
        <v-row v-if="tasksStore.loading">
          <v-col cols="12" class="text-center py-8">
            <v-progress-circular indeterminate color="primary" />
          </v-col>
        </v-row>

        <v-row v-else-if="activeTasks.length === 0">
          <v-col cols="12" class="text-center py-8">
            <v-icon size="64" color="grey-lighten-1">mdi-checkbox-marked-circle-auto-outline</v-icon>
            <div class="text-h6 mt-4">Keine aktiven Aufgaben</div>
            <v-btn color="primary" class="mt-4" @click="openCreateDialog">
              Erste Aufgabe erstellen
            </v-btn>
          </v-col>
        </v-row>

        <div v-else>
          <!-- Overdue Tasks -->
          <div v-if="overdueTasks.length > 0" class="mb-3">
            <div class="text-caption text-error px-2 mb-1">
              ÜBERFÄLLIG ({{ overdueTasks.length }})
            </div>
            <v-card variant="outlined" color="error">
              <v-list density="compact" class="py-0">
                <template v-for="(task, index) in overdueTasks" :key="task.id">
                  <TaskItemSimple
                    :task="task"
                    @complete="completeTask"
                    @click="openTaskMenu(task)"
                  />
                  <v-divider v-if="index < overdueTasks.length - 1" />
                </template>
              </v-list>
            </v-card>
          </div>

          <!-- Today's Tasks -->
          <div v-if="todayTasks.length > 0" class="mb-3">
            <div class="text-caption text-warning px-2 mb-1">
              HEUTE ({{ todayTasks.length }})
            </div>
            <v-card variant="outlined" color="warning">
              <v-list density="compact" class="py-0">
                <template v-for="(task, index) in todayTasks" :key="task.id">
                  <TaskItemSimple
                    :task="task"
                    @complete="completeTask"
                    @click="openTaskMenu(task)"
                  />
                  <v-divider v-if="index < todayTasks.length - 1" />
                </template>
              </v-list>
            </v-card>
          </div>

          <!-- Upcoming Tasks -->
          <div v-if="upcomingTasks.length > 0" class="mb-3">
            <div class="text-caption text-medium-emphasis px-2 mb-1">
              DEMNÄCHST ({{ upcomingTasks.length }})
            </div>
            <v-card variant="outlined">
              <v-list density="compact" class="py-0">
                <template v-for="(task, index) in upcomingTasks" :key="task.id">
                  <TaskItemSimple
                    :task="task"
                    @complete="completeTask"
                    @click="openTaskMenu(task)"
                  />
                  <v-divider v-if="index < upcomingTasks.length - 1" />
                </template>
              </v-list>
            </v-card>
          </div>
        </div>
      </v-container>
    </v-main>

    <!-- FAB for adding tasks -->
    <v-btn
      icon="mdi-plus"
      color="primary"
      size="large"
      position="fixed"
      location="bottom end"
      class="mb-16 me-4"
      @click="openCreateDialog"
    />

    <!-- Task Dialog -->
    <TaskDialogNew
      v-model="taskDialog"
      :task="selectedTask"
      :categories="categoriesStore.categories"
      :space-members="spaceMembers"
      @save="saveTask"
    />

    <!-- Task Menu Bottom Sheet -->
    <v-bottom-sheet v-model="taskMenuSheet">
      <v-card v-if="selectedTask">
        <v-card-title class="text-h6">{{ selectedTask.title }}</v-card-title>
        <v-card-text v-if="selectedTask.description" class="text-body-2">
          {{ selectedTask.description }}
        </v-card-text>

        <v-list>
          <v-list-item @click="skipTask(selectedTask); taskMenuSheet = false">
            <template #prepend>
              <v-icon icon="mdi-skip-next" />
            </template>
            <v-list-item-title>Überspringen</v-list-item-title>
          </v-list-item>

          <v-list-item @click="openEditDialog(selectedTask); taskMenuSheet = false">
            <template #prepend>
              <v-icon icon="mdi-pencil" />
            </template>
            <v-list-item-title>Bearbeiten</v-list-item-title>
          </v-list-item>

          <v-list-item @click="taskMenuSheet = false; confirmDeleteTask(selectedTask)">
            <template #prepend>
              <v-icon icon="mdi-delete" color="error" />
            </template>
            <v-list-item-title class="text-error">Löschen</v-list-item-title>
          </v-list-item>

          <v-divider />

          <v-list-item @click="taskMenuSheet = false">
            <v-list-item-title>Abbrechen</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-bottom-sheet>

    <!-- Space Settings Bottom Sheet -->
    <v-bottom-sheet v-model="settingsSheet" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          <span>Space-Einstellungen</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="settingsSheet = false" />
        </v-card-title>

        <v-card-text>
          <div class="text-subtitle-2 mb-2">Kategorien</div>

          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            block
            variant="outlined"
            class="mb-3"
            @click="openCategoryDialog(null)"
          >
            Neue Kategorie
          </v-btn>

          <v-list density="compact">
            <v-list-item
              v-for="category in categoriesStore.categories"
              :key="category.id"
            >
              <template #prepend>
                <v-icon :color="category.color">{{ category.icon }}</v-icon>
              </template>

              <v-list-item-title>{{ category.name }}</v-list-item-title>

              <template #append>
                <v-btn
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click="openCategoryDialog(category)"
                />
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click="confirmDeleteCategory(category)"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-bottom-sheet>

    <!-- Category Dialog -->
    <v-bottom-sheet v-model="categoryDialog">
      <v-card>
        <v-card-title>{{ selectedCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="categoryForm.name"
            label="Name"
            variant="outlined"
          />

          <v-text-field
            v-model="categoryForm.color"
            label="Farbe"
            type="color"
            variant="outlined"
          />

          <v-text-field
            v-model="categoryForm.icon"
            label="Icon (Material Design Icons)"
            placeholder="mdi-home"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn @click="categoryDialog = false">Abbrechen</v-btn>
          <v-spacer />
          <v-btn color="primary" @click="saveCategory">
            {{ selectedCategory ? 'Speichern' : 'Erstellen' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Delete Dialogs -->
    <v-dialog v-model="deleteTaskDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Aufgabe löschen?</v-card-title>
        <v-card-text>
          Möchten Sie "{{ selectedTask?.title }}" wirklich löschen?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="deleteTaskDialog = false">Abbrechen</v-btn>
          <v-btn color="error" variant="elevated" @click="deleteTask">Löschen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteCategoryDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Kategorie löschen?</v-card-title>
        <v-card-text>
          Möchten Sie "{{ selectedCategory?.name }}" wirklich löschen?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="deleteCategoryDialog = false">Abbrechen</v-btn>
          <v-btn color="error" variant="elevated" @click="deleteCategory">Löschen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :timeout="2000" :color="snackbarColor" location="top">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSpacesStore } from '../stores/spaces.js';
import { useTasksStore } from '../stores/tasks.js';
import { useCategoriesStore } from '../stores/categories.js';
import { useSSE } from '../composables/useSSE.js';
import TaskItemSimple from '../components/TaskItemSimple.vue';
import TaskDialogNew from '../components/TaskDialogNew.vue';

const route = useRoute();
const router = useRouter();
const spacesStore = useSpacesStore();
const tasksStore = useTasksStore();
const categoriesStore = useCategoriesStore();

const spaceId = computed(() => route.params.id);

// Dialog states
const taskDialog = ref(false);
const selectedTask = ref(null);
const taskMenuSheet = ref(false);
const deleteTaskDialog = ref(false);
const settingsSheet = ref(false);
const categoryDialog = ref(false);
const selectedCategory = ref(null);
const deleteCategoryDialog = ref(false);

const categoryForm = ref({
  name: '',
  color: '#FF5722',
  icon: 'mdi-tag'
});

const spaceMembers = ref([]);

const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

// Filter active tasks (exclude inactive)
const activeTasks = computed(() =>
  tasksStore.tasks.filter(t => t.recurrence_type !== 'inactive')
);

// Group active tasks by status
const overdueTasks = computed(() =>
  activeTasks.value.filter(t => t.is_overdue)
);

const todayTasks = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  return activeTasks.value.filter(t => !t.is_overdue && t.next_due_date === today);
});

const upcomingTasks = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  return activeTasks.value.filter(t => t.next_due_date > today);
});

onMounted(async () => {
  await spacesStore.fetchSpace(spaceId.value);
  await tasksStore.fetchTasks(spaceId.value);
  await categoriesStore.fetchCategories(spaceId.value);

  // Connect to SSE for real-time updates
  useSSE(spaceId.value, (message) => {
    tasksStore.handleSSEMessage(message);
  });
});

// Task Management
function openCreateDialog() {
  selectedTask.value = null;
  taskDialog.value = true;
}

function openTaskMenu(task) {
  selectedTask.value = task;
  taskMenuSheet.value = true;
}

function openEditDialog(task) {
  selectedTask.value = task;
  taskDialog.value = true;
}

async function saveTask(data) {
  try {
    if (selectedTask.value) {
      await tasksStore.updateTask(spaceId.value, selectedTask.value.id, data);
      snackbarMessage.value = 'Aufgabe aktualisiert';
    } else {
      await tasksStore.createTask(spaceId.value, data);
      snackbarMessage.value = 'Aufgabe erstellt';
    }
    snackbarColor.value = 'success';
    showSnackbar.value = true;
    selectedTask.value = null;
  } catch (error) {
    console.error('Failed to save task:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function confirmDeleteTask(task) {
  selectedTask.value = task;
  deleteTaskDialog.value = true;
}

async function deleteTask() {
  try {
    await tasksStore.deleteTask(spaceId.value, selectedTask.value.id);
    deleteTaskDialog.value = false;
    selectedTask.value = null;
    snackbarMessage.value = 'Aufgabe gelöscht';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to delete task:', error);
    snackbarMessage.value = 'Fehler beim Löschen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function completeTask(task) {
  try {
    await tasksStore.completeTask(spaceId.value, task.id, {});
    snackbarMessage.value = 'Aufgabe erledigt';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to complete task:', error);
    snackbarMessage.value = 'Fehler beim Erledigen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function skipTask(task) {
  try {
    await tasksStore.skipTask(spaceId.value, task.id, {});
    snackbarMessage.value = 'Aufgabe übersprungen';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to skip task:', error);
    snackbarMessage.value = 'Fehler beim Überspringen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

// Category Management
function openCategoryDialog(category) {
  selectedCategory.value = category;
  if (category) {
    categoryForm.value = {
      name: category.name,
      color: category.color,
      icon: category.icon
    };
  } else {
    categoryForm.value = {
      name: '',
      color: '#FF5722',
      icon: 'mdi-tag'
    };
  }
  categoryDialog.value = true;
}

async function saveCategory() {
  if (!categoryForm.value.name.trim()) {
    snackbarMessage.value = 'Bitte geben Sie einen Namen ein';
    snackbarColor.value = 'warning';
    showSnackbar.value = true;
    return;
  }

  try {
    if (selectedCategory.value) {
      await categoriesStore.updateCategory(
        spaceId.value,
        selectedCategory.value.id,
        categoryForm.value
      );
      snackbarMessage.value = 'Kategorie aktualisiert';
    } else {
      await categoriesStore.createCategory(spaceId.value, categoryForm.value);
      snackbarMessage.value = 'Kategorie erstellt';
    }
    snackbarColor.value = 'success';
    showSnackbar.value = true;
    categoryDialog.value = false;
    selectedCategory.value = null;
  } catch (error) {
    console.error('Failed to save category:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function confirmDeleteCategory(category) {
  selectedCategory.value = category;
  deleteCategoryDialog.value = true;
}

async function deleteCategory() {
  try {
    await categoriesStore.deleteCategory(spaceId.value, selectedCategory.value.id);
    deleteCategoryDialog.value = false;
    selectedCategory.value = null;
    snackbarMessage.value = 'Kategorie gelöscht';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to delete category:', error);
    snackbarMessage.value = 'Fehler beim Löschen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function goBack() {
  router.push('/');
}
</script>
