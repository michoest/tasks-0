<template>
  <v-main class="bg-background">
    <v-container fluid class="pa-4">
      <!-- View Toggle & Date Navigation -->
      <div class="d-flex align-center mb-4">
        <v-btn-toggle v-model="viewMode" mandatory density="compact" color="primary">
          <v-btn value="day" size="small">Tag</v-btn>
          <v-btn value="week" size="small">Woche</v-btn>
        </v-btn-toggle>

        <v-spacer />

        <v-btn icon="mdi-chevron-left" variant="text" density="compact" @click="navigatePrev" />
        <v-btn variant="text" density="compact" @click="goToToday" class="mx-1">
          {{ formatHeaderDate }}
        </v-btn>
        <v-btn icon="mdi-chevron-right" variant="text" density="compact" @click="navigateNext" />
      </div>

      <!-- Loading -->
      <v-row v-if="loading">
        <v-col cols="12" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
        </v-col>
      </v-row>

      <!-- Day View -->
      <template v-else-if="viewMode === 'day'">
        <v-card elevation="0">
          <v-card-title class="text-h6 pb-0">
            {{ formatDayTitle(selectedDate) }}
          </v-card-title>
          <v-card-subtitle class="text-caption">
            {{ getTaskCountForDate(selectedDate) }} Aufgaben
          </v-card-subtitle>

          <v-list v-if="dayTasks.length > 0" class="pa-0" lines="two">
            <v-list-item
              v-for="task in dayTasks"
              :key="`${task.space_id}-${task.id}-${task.projected_date || task.next_due_date}`"
              class="px-4 py-3"
              :class="{ 'opacity-60': task.is_projection }"
            >
              <template #prepend>
                <v-icon
                  :icon="task.is_projection ? 'mdi-calendar-clock' : 'mdi-checkbox-blank-circle-outline'"
                  :color="task.is_projection ? 'grey' : 'primary'"
                  class="mr-3"
                />
              </template>

              <div class="d-flex align-center flex-wrap ga-2 mb-1">
                <span class="d-inline-flex align-center text-caption">
                  <v-icon icon="mdi-folder" size="small" class="mr-1" :color="task.space_color || 'grey'" />
                  {{ task.space_name }}
                </span>
                <span v-if="task.category" class="d-inline-flex align-center text-caption">
                  <v-icon :icon="task.category.icon || 'mdi-tag'" :color="task.category.color" size="small" class="mr-1" />
                  {{ task.category.name }}
                </span>
                <v-chip v-if="task.is_projection" size="x-small" color="grey" variant="outlined">
                  Projektion
                </v-chip>
              </div>

              <v-list-item-title class="text-body-1 font-weight-medium">
                {{ task.title }}
              </v-list-item-title>

              <v-list-item-subtitle v-if="task.has_specific_time" class="text-caption mt-1">
                <v-icon icon="mdi-clock-outline" size="small" class="mr-1" />
                {{ task.time_of_day }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-card-text v-else class="text-center py-8">
            <v-icon size="48" color="grey-lighten-1">mdi-calendar-blank</v-icon>
            <div class="text-body-2 text-medium-emphasis mt-2">
              Keine Aufgaben an diesem Tag
            </div>
          </v-card-text>
        </v-card>
      </template>

      <!-- Week View -->
      <template v-else>
        <div class="week-grid">
          <v-card
            v-for="day in weekDays"
            :key="day.date"
            elevation="0"
            class="week-day-card"
            :class="{ 'today-card': isToday(day.date), 'selected-card': day.date === selectedDate }"
            @click="selectDay(day.date)"
          >
            <v-card-title class="text-caption pa-2 pb-1 d-flex align-center">
              <span :class="{ 'text-primary font-weight-bold': isToday(day.date) }">
                {{ day.dayName }}
              </span>
              <v-spacer />
              <span class="text-body-2" :class="{ 'text-primary font-weight-bold': isToday(day.date) }">
                {{ day.dayNumber }}
              </span>
            </v-card-title>

            <v-card-text class="pa-2 pt-0">
              <div
                v-for="task in getTasksForDate(day.date).slice(0, 4)"
                :key="`${task.space_id}-${task.id}-${task.projected_date || task.next_due_date}`"
                class="week-task-item mb-1"
                :class="{ 'opacity-60': task.is_projection }"
              >
                <v-icon
                  :icon="task.category?.icon || 'mdi-checkbox-blank-circle'"
                  :color="task.category?.color || 'grey'"
                  size="x-small"
                  class="mr-1"
                />
                <span class="text-caption text-truncate">{{ task.title }}</span>
              </div>
              <div v-if="getTasksForDate(day.date).length > 4" class="text-caption text-medium-emphasis">
                +{{ getTasksForDate(day.date).length - 4 }} weitere
              </div>
              <div v-if="getTasksForDate(day.date).length === 0" class="text-caption text-medium-emphasis">
                -
              </div>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <!-- Legend -->
      <v-card elevation="0" class="mt-4">
        <v-card-text class="d-flex align-center ga-4 text-caption">
          <span class="d-flex align-center">
            <v-icon icon="mdi-checkbox-blank-circle-outline" size="small" color="primary" class="mr-1" />
            Fällig
          </span>
          <span class="d-flex align-center opacity-60">
            <v-icon icon="mdi-calendar-clock" size="small" color="grey" class="mr-1" />
            Projektion (basierend auf Wiederholungsmuster)
          </span>
        </v-card-text>
      </v-card>
    </v-container>
  </v-main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSpacesStore } from '../stores/spaces.js';
import { api } from '../composables/useApi.js';

const spacesStore = useSpacesStore();

const loading = ref(false);
const allTasks = ref([]);
const viewMode = ref('week');
const selectedDate = ref(new Date().toISOString().split('T')[0]);

// Week start (Monday of current week)
const weekStart = ref(getMonday(new Date()));

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// Navigation
function navigatePrev() {
  if (viewMode.value === 'day') {
    const d = new Date(selectedDate.value);
    d.setDate(d.getDate() - 1);
    selectedDate.value = d.toISOString().split('T')[0];
  } else {
    const d = new Date(weekStart.value);
    d.setDate(d.getDate() - 7);
    weekStart.value = d.toISOString().split('T')[0];
  }
}

function navigateNext() {
  if (viewMode.value === 'day') {
    const d = new Date(selectedDate.value);
    d.setDate(d.getDate() + 1);
    selectedDate.value = d.toISOString().split('T')[0];
  } else {
    const d = new Date(weekStart.value);
    d.setDate(d.getDate() + 7);
    weekStart.value = d.toISOString().split('T')[0];
  }
}

function goToToday() {
  const today = new Date().toISOString().split('T')[0];
  selectedDate.value = today;
  weekStart.value = getMonday(new Date());
}

function selectDay(date) {
  selectedDate.value = date;
  viewMode.value = 'day';
}

// Format header date
const formatHeaderDate = computed(() => {
  if (viewMode.value === 'day') {
    const d = new Date(selectedDate.value);
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  } else {
    const start = new Date(weekStart.value);
    const end = new Date(weekStart.value);
    end.setDate(end.getDate() + 6);
    const startStr = start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }
});

// Week days
const weekDays = computed(() => {
  const days = [];
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.value);
    d.setDate(d.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      dayName: dayNames[i],
      dayNumber: d.getDate()
    });
  }
  return days;
});

function isToday(date) {
  return date === new Date().toISOString().split('T')[0];
}

function formatDayTitle(date) {
  const d = new Date(date);
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return `${dayNames[d.getDay()]}, ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

// Project future occurrences for a task
function projectOccurrences(task, startDate, endDate) {
  const occurrences = [];

  // Only project recurring tasks
  if (task.task_type !== 'recurring' || !task.next_due_date) {
    return occurrences;
  }

  // Start from the task's current next_due_date
  let currentDate = new Date(task.next_due_date);
  const end = new Date(endDate);

  // Project up to 50 occurrences to avoid infinite loops
  let count = 0;
  while (currentDate <= end && count < 50) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Only include dates after the real next_due_date (those are projections)
    if (dateStr > task.next_due_date && dateStr >= startDate) {
      occurrences.push({
        ...task,
        projected_date: dateStr,
        is_projection: true
      });
    }

    // Calculate next occurrence
    currentDate = calculateNextDate(task, currentDate);
    if (!currentDate) break;
    count++;
  }

  return occurrences;
}

// Calculate next date based on recurrence pattern
function calculateNextDate(task, fromDate) {
  if (task.recurrence_type === 'interval') {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + (task.interval_days || 1));

    if (task.interval_exclude_weekends) {
      const day = next.getDay();
      if (day === 0) next.setDate(next.getDate() + 1);
      else if (day === 6) next.setDate(next.getDate() + 2);
    }

    return next;
  }

  if (task.recurrence_type === 'schedule') {
    try {
      const pattern = JSON.parse(task.schedule_pattern);

      if (pattern.type === 'weekly') {
        return calculateWeeklyNext(pattern.weekdays, fromDate);
      }

      if (pattern.type === 'monthly') {
        return calculateMonthlyNext(pattern.days, fromDate);
      }
    } catch (e) {
      console.error('Failed to parse schedule pattern:', e);
    }
  }

  return null;
}

function calculateWeeklyNext(weekdays, fromDate) {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const current = new Date(fromDate);
  current.setDate(current.getDate() + 1);

  for (let i = 0; i < 14; i++) {
    const day = current.getDay();
    if (sorted.includes(day)) {
      return current;
    }
    current.setDate(current.getDate() + 1);
  }

  return null;
}

function calculateMonthlyNext(days, fromDate) {
  const sorted = [...days].sort((a, b) => a - b);
  const current = new Date(fromDate);
  const currentDay = current.getDate();

  const nextInMonth = sorted.find(d => d > currentDay);
  if (nextInMonth) {
    const testDate = new Date(current.getFullYear(), current.getMonth(), nextInMonth);
    if (testDate.getDate() === nextInMonth) {
      return testDate;
    }
  }

  current.setMonth(current.getMonth() + 1);
  for (const day of sorted) {
    const testDate = new Date(current.getFullYear(), current.getMonth(), day);
    if (testDate.getDate() === day) {
      return testDate;
    }
  }

  return null;
}

// Get all tasks (real + projected) for a date range
const allTasksWithProjections = computed(() => {
  // Calculate date range (4 weeks ahead for projections)
  const today = new Date();
  const startDate = new Date(weekStart.value);
  startDate.setDate(startDate.getDate() - 7); // Include previous week
  const endDate = new Date(weekStart.value);
  endDate.setDate(endDate.getDate() + 35); // 5 weeks ahead

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const result = [];

  for (const task of allTasks.value) {
    // Skip inactive and completed tasks
    if (task.status !== 'active') continue;

    // Add the real task if it falls within range
    if (task.next_due_date && task.next_due_date >= startStr && task.next_due_date <= endStr) {
      result.push({ ...task, is_projection: false });
    }

    // Add projections for recurring tasks
    const projections = projectOccurrences(task, startStr, endStr);
    result.push(...projections);
  }

  return result;
});

// Get tasks for a specific date
function getTasksForDate(date) {
  return allTasksWithProjections.value
    .filter(t => {
      const taskDate = t.projected_date || t.next_due_date;
      return taskDate === date;
    })
    .sort((a, b) => {
      // Real tasks before projections
      if (a.is_projection !== b.is_projection) return a.is_projection ? 1 : -1;
      // Then by time
      if (a.has_specific_time && b.has_specific_time) {
        return a.time_of_day.localeCompare(b.time_of_day);
      }
      if (a.has_specific_time) return -1;
      if (b.has_specific_time) return 1;
      return 0;
    });
}

// Tasks for selected day
const dayTasks = computed(() => getTasksForDate(selectedDate.value));

function getTaskCountForDate(date) {
  return getTasksForDate(date).length;
}

// Fetch data
onMounted(async () => {
  await refreshAll();
});

async function refreshAll() {
  loading.value = true;
  try {
    await spacesStore.fetchSpaces();

    const taskPromises = spacesStore.spaces.map(async (space) => {
      try {
        const res = await api.get(`/spaces/${space.id}/tasks`);
        return res.tasks.map(task => ({
          ...task,
          space_id: space.id,
          space_name: space.personal_name || space.name,
          space_color: space.personal_color
        }));
      } catch (error) {
        console.error(`Failed to fetch tasks for space ${space.id}:`, error);
        return [];
      }
    });

    const tasksArrays = await Promise.all(taskPromises);
    allTasks.value = tasksArrays.flat();
  } finally {
    loading.value = false;
  }
}

// Update projections when week changes
watch(weekStart, () => {
  // Projections are computed, so this is just for potential future optimizations
});
</script>

<style scoped>
.bg-background {
  background-color: #F9FAFB;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

@media (max-width: 600px) {
  .week-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.week-day-card {
  min-height: 120px;
  cursor: pointer;
  transition: all 0.2s;
}

.week-day-card:hover {
  background-color: #f5f5f5;
}

.today-card {
  border: 2px solid rgb(var(--v-theme-primary));
}

.selected-card {
  background-color: #e8eaf6;
}

.week-task-item {
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
}

.opacity-60 {
  opacity: 0.6;
}
</style>
