<template>
  <v-main class="bg-background">
    <v-container fluid class="pa-4">
      <h1 class="text-h5 font-weight-bold mb-4">Verlauf & Statistiken</h1>

      <v-row v-if="loading">
        <v-col cols="12" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
        </v-col>
      </v-row>

      <template v-else>
        <!-- Daily Completion Stats -->
        <v-card class="mb-4" elevation="0">
          <v-card-title class="d-flex align-center">
            <span class="text-h6">Erledigte Aufgaben</span>
            <v-spacer />
            <v-btn-toggle v-model="daysRange" density="compact" mandatory>
              <v-btn :value="7" size="small">7T</v-btn>
              <v-btn :value="14" size="small">14T</v-btn>
              <v-btn :value="30" size="small">30T</v-btn>
            </v-btn-toggle>
          </v-card-title>
          <v-card-text>
            <div v-if="completionStats.length > 0" class="completion-chart">
              <div class="chart-container">
                <div
                  v-for="day in chartDays"
                  :key="day.date"
                  class="chart-bar-container"
                >
                  <div class="chart-bar-wrapper">
                    <div
                      class="chart-bar"
                      :style="{
                        height: `${(day.count / maxDailyCount) * 100}%`,
                        backgroundColor: day.count > 0 ? '#4CAF50' : '#E0E0E0'
                      }"
                    >
                      <span v-if="day.count > 0" class="bar-label">{{ day.count }}</span>
                    </div>
                  </div>
                  <div class="chart-label">{{ day.label }}</div>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1">mdi-chart-bar</v-icon>
              <p class="text-body-1 text-medium-emphasis mt-4">
                Noch keine erledigten Aufgaben
              </p>
            </div>

            <!-- Summary stats -->
            <v-divider class="my-4" />
            <div class="d-flex justify-space-around text-center">
              <div>
                <div class="text-h4 font-weight-bold text-success">{{ totalCompleted }}</div>
                <div class="text-caption text-medium-emphasis">Erledigt</div>
              </div>
              <div>
                <div class="text-h4 font-weight-bold text-warning">{{ totalSkipped }}</div>
                <div class="text-caption text-medium-emphasis">Übersprungen</div>
              </div>
              <div>
                <div class="text-h4 font-weight-bold text-primary">{{ avgPerDay }}</div>
                <div class="text-caption text-medium-emphasis">Ø pro Tag</div>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Task Timeline -->
        <v-card elevation="0">
          <v-card-title class="text-h6">Aufgaben-Verlauf</v-card-title>
          <v-card-text>
            <div v-if="taskOccurrences.length > 0">
              <v-text-field
                v-model="taskSearch"
                placeholder="Aufgaben suchen..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                class="mb-4"
              />
              <div
                v-for="task in filteredTasks"
                :key="task.id"
                class="task-timeline mb-4"
              >
                <div class="d-flex align-center mb-2">
                  <v-icon
                    v-if="task.category_icon"
                    :icon="task.category_icon"
                    :color="task.category_color"
                    size="small"
                    class="mr-2"
                  />
                  <span class="font-weight-medium">{{ task.title }}</span>
                  <v-chip size="x-small" variant="outlined" class="ml-2">
                    {{ task.completions.length }}x
                  </v-chip>
                </div>
                <div class="timeline-dots">
                  <div
                    v-for="(day, idx) in getTaskTimelineDays(task)"
                    :key="idx"
                    class="timeline-dot"
                    :class="{
                      'completed': day.status === 'completed',
                      'skipped': day.status === 'skipped',
                      'empty': day.status === 'empty'
                    }"
                    :title="day.date"
                  />
                </div>
                <div class="d-flex justify-space-between text-caption text-medium-emphasis mt-1">
                  <span>{{ daysRange }} Tage</span>
                  <span>Heute</span>
                </div>
              </div>
              <div v-if="filteredTasks.length === 0" class="text-center py-4">
                <p class="text-body-2 text-medium-emphasis">
                  Keine Aufgaben gefunden
                </p>
              </div>
            </div>
            <div v-else class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1">mdi-timeline-clock</v-icon>
              <p class="text-body-1 text-medium-emphasis mt-4">
                Noch keine wiederkehrenden Aufgaben mit Verlauf
              </p>
            </div>
          </v-card-text>
        </v-card>
      </template>
    </v-container>
  </v-main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../composables/useApi.js';

const loading = ref(true);
const completionStats = ref([]);
const taskOccurrences = ref([]);
const daysRange = ref(14);
const taskSearch = ref('');

onMounted(async () => {
  await loadStats();
});

watch(daysRange, async () => {
  await loadStats();
});

async function loadStats() {
  loading.value = true;
  try {
    const [statsRes, occurrencesRes] = await Promise.all([
      api.get(`/stats/completions-per-day?days=${daysRange.value}`),
      api.get(`/stats/task-occurrences?days=${daysRange.value}`)
    ]);
    completionStats.value = statsRes.stats;
    taskOccurrences.value = occurrencesRes.tasks;
  } catch (error) {
    console.error('Failed to load stats:', error);
  } finally {
    loading.value = false;
  }
}

// Create a map of date -> stats for quick lookup
const statsMap = computed(() => {
  const map = new Map();
  completionStats.value.forEach(stat => {
    map.set(stat.date, stat);
  });
  return map;
});

// Generate chart days with filled gaps
const chartDays = computed(() => {
  const days = [];
  const today = new Date();

  for (let i = daysRange.value - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const stat = statsMap.value.get(dateStr);

    days.push({
      date: dateStr,
      label: i === 0 ? 'Heute' : (i === 1 ? 'Gestern' : `${date.getDate()}.${date.getMonth() + 1}`),
      count: stat ? stat.count : 0,
      completed: stat ? stat.completed : 0,
      skipped: stat ? stat.skipped : 0
    });
  }

  return days;
});

const maxDailyCount = computed(() => {
  const max = Math.max(...chartDays.value.map(d => d.count), 1);
  return max;
});

const totalCompleted = computed(() => {
  return chartDays.value.reduce((sum, d) => sum + d.completed, 0);
});

const totalSkipped = computed(() => {
  return chartDays.value.reduce((sum, d) => sum + d.skipped, 0);
});

const avgPerDay = computed(() => {
  const total = totalCompleted.value + totalSkipped.value;
  const avg = total / daysRange.value;
  return avg.toFixed(1);
});

const filteredTasks = computed(() => {
  if (!taskSearch.value) {
    return taskOccurrences.value;
  }
  const search = taskSearch.value.toLowerCase();
  return taskOccurrences.value.filter(t =>
    t.title.toLowerCase().includes(search) ||
    (t.category_name && t.category_name.toLowerCase().includes(search))
  );
});

function getTaskTimelineDays(task) {
  const days = [];
  const today = new Date();
  const completionsMap = new Map();

  task.completions.forEach(c => {
    completionsMap.set(c.date, c.skipped ? 'skipped' : 'completed');
  });

  for (let i = daysRange.value - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    days.push({
      date: dateStr,
      status: completionsMap.get(dateStr) || 'empty'
    });
  }

  return days;
}
</script>

<style scoped>
.bg-background {
  background-color: #F9FAFB;
}

.completion-chart {
  overflow-x: auto;
}

.chart-container {
  display: flex;
  align-items: flex-end;
  height: 120px;
  gap: 4px;
  min-width: max-content;
}

.chart-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 24px;
}

.chart-bar-wrapper {
  height: 100px;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.chart-bar {
  width: 100%;
  max-width: 32px;
  min-height: 4px;
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.3s ease;
}

.bar-label {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  color: #666;
}

.chart-label {
  font-size: 10px;
  color: #999;
  margin-top: 4px;
  white-space: nowrap;
}

.task-timeline {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.timeline-dots {
  display: flex;
  gap: 3px;
}

.timeline-dot {
  flex: 1;
  height: 8px;
  border-radius: 2px;
  min-width: 4px;
}

.timeline-dot.completed {
  background-color: #4CAF50;
}

.timeline-dot.skipped {
  background-color: #FF9800;
}

.timeline-dot.empty {
  background-color: #E0E0E0;
}
</style>
