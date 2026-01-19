<template>
  <!-- Task List -->
  <div v-if="tasks.length > 0" class="task-list">
    <div
      v-for="task in tasks"
      :key="task.id"
      class="task-item"
      :class="{ 'task-overdue': task.is_overdue, 'task-completed': task.status === 'completed' }"
      @click="$emit('task-click', task)"
    >
      <div class="task-checkbox" @click.stop="$emit('task-complete', task)">
        <v-icon v-if="task.completing" color="success">mdi-check-circle</v-icon>
        <v-icon v-else color="grey-lighten-1">mdi-circle-outline</v-icon>
      </div>

      <div class="task-content">
        <div class="task-title">{{ task.title }}</div>
        <div v-if="task.progress !== null && task.progress !== undefined" class="task-progress">
          <div class="task-progress-bar">
            <div class="task-progress-fill" :style="{ width: `${task.progress * 100}%` }"></div>
          </div>
          <span class="task-progress-text">{{ Math.round(task.progress * 100) }}%</span>
        </div>
        <div v-if="task.next_due_date || task.description" class="task-subtitle">
          <span v-if="task.next_due_date" class="task-date" :class="{ 'date-overdue': task.is_overdue, 'date-today': isToday(task.next_due_date) }">
            {{ formatDate(task.next_due_date) }}
            <span v-if="task.has_specific_time">, {{ task.time_of_day }}</span>
          </span>
          <span v-if="task.next_due_date && task.description" class="mx-1">·</span>
          <span v-if="task.description" class="task-desc">{{ truncate(task.description, 40) }}</span>
        </div>
      </div>

      <div v-if="task.category && showCategory" class="task-category">
        <v-icon :color="task.category.color" :icon="task.category.icon || 'mdi-tag'" size="16"></v-icon>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-else class="empty-state">
    <v-icon size="64" color="grey-lighten-2">mdi-checkbox-marked-circle-outline</v-icon>
    <div class="empty-title">Keine Aufgaben</div>
    <div class="empty-subtitle">Keine Aufgaben in dieser Liste</div>
  </div>
</template>

<script setup>
defineProps({
  tasks: { type: Array, default: () => [] },
  showCategory: { type: Boolean, default: true }
});

defineEmits(['task-click', 'task-complete']);

function isToday(dateStr) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateStr === todayStr;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Parse as local date (not UTC) by splitting the date string
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) return 'Heute';
  if (dateStr === tomorrowStr) return 'Morgen';

  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${days[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}.`;
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}
</script>

<style scoped>
/* Task List */
.task-list {
  padding: 8px 0;
}

.task-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.15s;
}

.task-item:hover {
  background: #fafafa;
}

.task-item:active {
  background: #f5f5f5;
}

.task-overdue {
  background: #fff8f8;
}

.task-checkbox {
  margin-right: 12px;
  margin-top: 2px;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 15px;
  line-height: 1.4;
  color: #212121;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.task-progress-bar {
  flex: 1;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  max-width: 100px;
}

.task-progress-fill {
  height: 100%;
  background: #1976d2;
  border-radius: 2px;
}

.task-progress-text {
  font-size: 11px;
  color: #1976d2;
  font-weight: 500;
}

.task-subtitle {
  font-size: 13px;
  color: #757575;
  margin-top: 2px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.task-date {
  color: #757575;
}

.date-overdue {
  color: #d32f2f;
  font-weight: 500;
}

.date-today {
  color: #1976d2;
  font-weight: 500;
}

.task-desc {
  color: #9e9e9e;
}

.task-category {
  margin-left: 12px;
  margin-top: 2px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: #424242;
  margin-top: 16px;
}

.empty-subtitle {
  font-size: 14px;
  color: #9e9e9e;
  margin-top: 4px;
}
</style>
