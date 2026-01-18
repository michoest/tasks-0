<template>
  <v-bottom-sheet :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" scrollable>
    <v-card v-if="task" class="action-sheet-card">
      <!-- Header -->
      <div class="sheet-header">
        <div class="sheet-title-row">
          <v-icon
            v-if="task.category"
            :color="task.category.color"
            :icon="task.category.icon || 'mdi-tag'"
            class="mr-2"
          />
          <span class="sheet-title">{{ task.title }}</span>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="$emit('update:modelValue', false)" />
      </div>

      <!-- Meta Info -->
      <div class="sheet-meta">
        <div v-if="showSpaceName && task.space_name" class="meta-chip">
          <v-icon size="14" :color="task.space_color || 'grey'">mdi-folder</v-icon>
          <span>{{ task.space_name }}</span>
        </div>
        <div v-if="task.category" class="meta-chip">
          <v-icon size="14" :color="task.category.color" :icon="task.category.icon || 'mdi-tag'"></v-icon>
          <span>{{ task.category.name }}</span>
        </div>
        <div v-if="task.next_due_date" class="meta-chip">
          <v-icon size="14">mdi-calendar</v-icon>
          <span>{{ formatDate(task.next_due_date) }}</span>
        </div>
        <div v-if="task.has_specific_time" class="meta-chip">
          <v-icon size="14">mdi-clock-outline</v-icon>
          <span>{{ task.time_of_day }}</span>
        </div>
        <div v-if="task.task_type === 'recurring'" class="meta-chip">
          <v-icon size="14">mdi-refresh</v-icon>
          <span>{{ getRecurrenceText(task) }}</span>
        </div>
      </div>

      <!-- 7-Day Stats (only for recurring tasks) -->
      <div v-if="task.task_type === 'recurring'" class="sheet-stats">
        <div class="stats-label">Letzte 7 Tage</div>
        <div class="stats-row">
          <div class="stats-days">
            <div
              v-for="(day, index) in last7Days"
              :key="index"
              class="stat-day"
              :class="getDayClass(day)"
              :title="getDayTooltip(day)"
            >
              <span class="day-letter">{{ day.letter }}</span>
              <v-icon
                v-if="day.status === 'completed'"
                size="12"
                color="success"
              >mdi-check</v-icon>
              <v-icon
                v-else-if="day.status === 'skipped'"
                size="12"
                color="warning"
              >mdi-debug-step-over</v-icon>
              <span v-else class="day-dot"></span>
            </div>
          </div>
          <div class="stats-summary">
            <span v-if="stats" class="text-caption text-medium-emphasis">
              {{ stats.summary.completed }} erledigt
              <span v-if="stats.summary.skipped">, {{ stats.summary.skipped }} übersprungen</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Progress (only if task has progress) -->
      <div v-if="task.progress !== null && task.progress !== undefined" class="sheet-progress">
        <div class="progress-header">
          <span class="progress-label">Fortschritt</span>
          <span class="progress-value">{{ Math.round(task.progress * 100) }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${task.progress * 100}%` }"></div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="task.description" class="sheet-description">
        {{ task.description }}
      </div>

      <!-- Actions -->
      <div class="sheet-actions">
        <v-btn variant="tonal" color="success" @click="$emit('complete')">
          <v-icon start>mdi-check</v-icon>
          Erledigen
        </v-btn>

        <v-btn v-if="canSkip" variant="tonal" @click="$emit('skip')">
          <v-icon start>mdi-debug-step-over</v-icon>
          Überspringen
        </v-btn>

        <v-btn v-if="canPostpone" variant="tonal" @click="$emit('postpone')">
          <v-icon start>mdi-calendar-clock</v-icon>
          Verschieben
        </v-btn>

        <v-btn variant="tonal" @click="$emit('edit')">
          <v-icon start>mdi-pencil</v-icon>
          Bearbeiten
        </v-btn>

        <v-btn v-if="showHistory" variant="tonal" @click="$emit('history')">
          <v-icon start>mdi-chart-timeline-variant</v-icon>
          Verlauf
        </v-btn>

        <v-btn variant="tonal" color="error" @click="$emit('delete')">
          <v-icon start>mdi-delete</v-icon>
          Löschen
        </v-btn>
      </div>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { api } from '../composables/useApi.js';

const props = defineProps({
  modelValue: Boolean,
  task: Object,
  showSpaceName: { type: Boolean, default: true },
  showHistory: { type: Boolean, default: true }
});

defineEmits(['update:modelValue', 'complete', 'skip', 'postpone', 'edit', 'history', 'delete']);

const stats = ref(null);

// Fetch stats when task changes or sheet opens
watch(() => [props.modelValue, props.task?.id], async ([isOpen, taskId]) => {
  if (isOpen && taskId && props.task?.task_type === 'recurring') {
    try {
      const res = await api.get(`/spaces/${props.task.space_id}/tasks/${taskId}/stats`);
      stats.value = res;
    } catch (error) {
      console.error('Failed to fetch task stats:', error);
      stats.value = null;
    }
  } else {
    stats.value = null;
  }
}, { immediate: true });

// Generate last 7 days data
const last7Days = computed(() => {
  const days = [];
  const dayLetters = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Find completion for this day
    const completion = stats.value?.stats?.find(s => s.date === dateStr);

    days.push({
      date: dateStr,
      letter: dayLetters[date.getDay()],
      status: completion ? (completion.skipped ? 'skipped' : 'completed') : 'none',
      completedBy: completion ? `${completion.first_name || ''} ${completion.last_name || ''}`.trim() : null
    });
  }

  return days;
});

function getDayClass(day) {
  return {
    'stat-completed': day.status === 'completed',
    'stat-skipped': day.status === 'skipped',
    'stat-none': day.status === 'none'
  };
}

function getDayTooltip(day) {
  if (day.status === 'completed') {
    return day.completedBy ? `Erledigt von ${day.completedBy}` : 'Erledigt';
  }
  if (day.status === 'skipped') {
    return 'Übersprungen';
  }
  return day.date;
}

const canSkip = computed(() => {
  if (!props.task) return false;
  return props.task.task_type === 'recurring';
});

const canPostpone = computed(() => {
  if (!props.task) return false;
  return props.task.recurrence_type === 'one_time' && props.task.next_due_date;
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Heute';
  if (dateStr === tomorrowStr) return 'Morgen';

  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
}

function getRecurrenceText(task) {
  if (task.recurrence_type === 'interval') {
    const days = task.interval_days || 1;
    return `Alle ${days} Tag${days > 1 ? 'e' : ''}`;
  }
  if (task.recurrence_type === 'schedule') {
    try {
      const pattern = JSON.parse(task.schedule_pattern);
      if (pattern.type === 'weekly') return 'Wöchentlich';
      if (pattern.type === 'monthly') return 'Monatlich';
    } catch (e) {}
  }
  return 'Wiederholend';
}
</script>

<style scoped>
.action-sheet-card {
  border-radius: 24px 24px 0 0 !important;
  padding: 20px;
}

.sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sheet-title-row {
  display: flex;
  align-items: center;
  flex: 1;
  padding-right: 8px;
}

.sheet-title {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.4;
}

.sheet-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.meta-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f5f5f5;
  border-radius: 12px;
  font-size: 12px;
  color: #616161;
}

.sheet-stats {
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 12px;
}

.stats-label {
  font-size: 12px;
  color: #9e9e9e;
  margin-bottom: 8px;
}

.stats-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats-days {
  display: flex;
  gap: 6px;
  justify-content: space-between;
}

.stat-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 32px;
}

.day-letter {
  font-size: 11px;
  color: #9e9e9e;
  font-weight: 500;
}

.day-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e0e0e0;
}

.stat-completed .day-letter {
  color: #4caf50;
}

.stat-skipped .day-letter {
  color: #ff9800;
}

.stats-summary {
  text-align: center;
}

.sheet-progress {
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 12px;
}

.sheet-progress .progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.sheet-progress .progress-label {
  font-size: 12px;
  color: #9e9e9e;
}

.sheet-progress .progress-value {
  font-size: 13px;
  font-weight: 500;
  color: #1976d2;
}

.sheet-progress .progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.sheet-progress .progress-fill {
  height: 100%;
  background: #1976d2;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.sheet-description {
  font-size: 14px;
  color: #616161;
  line-height: 1.5;
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 12px;
}

.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sheet-actions .v-btn {
  flex: 1 1 calc(50% - 4px);
  min-width: 120px;
}

@media (max-width: 400px) {
  .sheet-actions .v-btn {
    flex: 1 1 100%;
  }
}
</style>
