<template>
  <div
    class="task-item"
    :class="{
      'task-overdue': variant === 'overdue',
      'task-today': variant === 'today',
      'task-inbox': variant === 'inbox'
    }"
    :style="overdueStyle"
    @click="$emit('click')"
  >
    <!-- Checkbox or Icon -->
    <div class="task-prepend">
      <template v-if="variant === 'inbox'">
        <v-icon icon="mdi-inbox" color="info" />
      </template>
      <template v-else>
        <v-checkbox
          :model-value="completing"
          @click.stop="$emit('complete')"
          hide-details
          color="success"
          density="compact"
        />
      </template>
    </div>

    <!-- Content -->
    <div class="task-content">
      <!-- Meta Row (space, category) -->
      <div v-if="showMeta" class="task-meta">
        <span v-if="showSpaceName && task.space_name" class="meta-item">
          <v-icon icon="mdi-folder" size="x-small" :color="task.space_color || 'grey'" />
          {{ task.space_name }}
        </span>
        <span v-if="task.category" class="meta-item">
          <v-icon :icon="task.category.icon || 'mdi-tag'" :color="task.category.color" size="x-small" />
          {{ task.category.name }}
        </span>
      </div>

      <!-- Title -->
      <div class="task-title">{{ task.title }}</div>

      <!-- Subtitle -->
      <div v-if="showSubtitle" class="task-subtitle">
        <template v-if="variant === 'overdue'">
          <span class="text-error">{{ task.days_overdue }}d überfällig</span>
        </template>
        <template v-if="variant === 'inbox' && task.transcript && task.transcript !== task.title">
          <span class="task-transcript">{{ truncate(task.transcript, 100) }}</span>
        </template>
        <template v-if="variant !== 'inbox'">
          <span v-if="task.has_specific_time" class="subtitle-item">
            <v-icon icon="mdi-clock-outline" size="x-small" />
            {{ task.time_of_day }}
          </span>
          <span v-if="task.task_type === 'recurring'" class="subtitle-item">
            <v-icon icon="mdi-refresh" size="x-small" />
            {{ getRecurrenceText(task) }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  task: { type: Object, required: true },
  variant: { type: String, default: 'default' }, // 'default', 'overdue', 'today', 'inbox'
  completing: { type: Boolean, default: false },
  showSpaceName: { type: Boolean, default: true },
  showMeta: { type: Boolean, default: true },
  showSubtitle: { type: Boolean, default: true }
});

defineEmits(['click', 'complete']);

const overdueStyle = computed(() => {
  if (props.variant !== 'overdue') return {};

  const days = props.task.days_overdue || 0;
  const intensity = Math.min(days / 7, 1);
  const r = Math.round(255 - intensity * 55);
  const g = Math.round(240 - intensity * 100);
  const b = Math.round(240 - intensity * 100);

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: intensity > 0.5 ? '#b71c1c' : undefined
  };
});

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function getRecurrenceText(task) {
  if (task.recurrence_type === 'interval') {
    const days = task.interval_days || 1;
    return `Alle ${days}d`;
  }
  if (task.recurrence_type === 'schedule') {
    try {
      const pattern = JSON.parse(task.schedule_pattern);
      if (pattern.type === 'weekly') return 'Wöchentlich';
      if (pattern.type === 'monthly') return 'Monatlich';
    } catch (e) {}
  }
  return '';
}
</script>

<style scoped>
.task-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: white;
  cursor: pointer;
  transition: background 0.15s;
}

.task-item:hover {
  background: #fafafa;
}

.task-item:active {
  background: #f5f5f5;
}

.task-prepend {
  margin-right: 12px;
  margin-top: 2px;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 2px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #757575;
}

.task-title {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  color: #212121;
}

.task-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
  font-size: 12px;
  color: #757575;
}

.subtitle-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.task-transcript {
  color: #9e9e9e;
  font-style: italic;
}

/* Variants */
.task-overdue {
  border-left: 3px solid #d32f2f;
}

.task-today {
  border-left: 3px solid #fb8c00;
}

.task-inbox {
  border-left: 3px solid #1976d2;
  background: #f8fbff;
}
</style>
