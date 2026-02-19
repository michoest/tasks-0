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

      <!-- Waiting Banner -->
      <div v-if="task.status === 'waiting' && task.waiting_reason" class="sheet-waiting-banner">
        <v-icon size="16" color="orange" class="mr-2">mdi-clock-alert-outline</v-icon>
        <span v-if="task.waiting_reason.type === 'blocked_by'">
          Blockiert durch: {{ task.waiting_reason.task_title }}
        </span>
        <span v-else-if="task.waiting_reason.type === 'waiting_for'">
          Wartet auf: {{ task.waiting_reason.contact }}
          <span v-if="task.waiting_reason.until"> (bis {{ formatDate(task.waiting_reason.until) }})</span>
        </span>
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

      <!-- Task Items -->
      <div v-if="task.items && task.items.length > 0" class="sheet-items">
        <div v-for="item in task.items" :key="item.id" class="item-chip" @click="handleItemClick(item)">
          <v-icon size="16" :color="getItemColor(item)">{{ getItemIcon(item) }}</v-icon>
          <span class="item-label">{{ item.label || item.value }}</span>
          <span v-if="item.item_type === 'contact' && item.reminder_date" class="item-date">
            {{ formatDate(item.reminder_date) }}
          </span>
          <v-btn icon="mdi-close" variant="text" size="x-small" density="compact"
            @click.stop="deleteItem(item)" class="item-delete" />
        </div>
      </div>

      <!-- Add Item Inline -->
      <div class="sheet-add-item">
        <div v-if="!addingItem" class="add-item-trigger" @click="addingItem = true">
          <v-icon size="14">mdi-plus</v-icon>
          <span>Verknüpfung hinzufügen</span>
        </div>
        <div v-else class="add-item-form">
          <div class="add-item-types">
            <div v-for="t in itemTypes" :key="t.type" class="type-chip"
              :class="{ 'type-selected': newItem.item_type === t.type }"
              @click="newItem.item_type = t.type">
              <v-icon size="14">{{ t.icon }}</v-icon>
              <span>{{ t.label }}</span>
            </div>
          </div>

          <!-- Type-specific fields -->
          <div class="add-item-fields">
            <template v-if="['phone', 'email', 'url'].includes(newItem.item_type)">
              <input v-model="newItem.value" :placeholder="getItemPlaceholder()" class="item-input" @keydown.enter="saveItem" />
              <input v-model="newItem.label" placeholder="Bezeichnung (optional)" class="item-input" @keydown.enter="saveItem" />
            </template>

            <template v-if="newItem.item_type === 'task'">
              <select v-model="newItem.referenced_task_id" class="item-input">
                <option :value="null" disabled>Aufgabe wählen...</option>
                <option v-for="t in availableTasks" :key="t.id" :value="t.id">{{ t.title }}</option>
              </select>
            </template>

            <template v-if="newItem.item_type === 'contact'">
              <input v-model="newItem.value" placeholder="Name" class="item-input" @keydown.enter="saveItem" />
              <div class="contact-options">
                <label class="contact-waiting">
                  <input type="checkbox" v-model="newItem.waiting" />
                  <span>Wartet auf Antwort</span>
                </label>
                <input v-if="newItem.waiting" v-model="newItem.reminder_date" type="date" class="item-input" />
              </div>
            </template>
          </div>

          <div class="add-item-actions">
            <v-btn size="small" variant="text" @click="cancelAddItem">Abbrechen</v-btn>
            <v-btn size="small" variant="tonal" color="primary" :disabled="!canSaveItem" @click="saveItem">Hinzufügen</v-btn>
          </div>
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

      <!-- Timer Section -->
      <div v-if="task.active_timer || task.total_time_seconds > 0" class="sheet-timer">
        <div class="d-flex align-center">
          <v-icon size="16" :color="task.active_timer ? 'primary' : 'grey'" class="mr-2">mdi-timer</v-icon>
          <span v-if="task.active_timer" class="timer-elapsed text-primary font-weight-bold">
            {{ formatElapsed(timerElapsed) }}
          </span>
          <span v-if="task.total_time_seconds > 0 && !task.active_timer" class="text-caption text-medium-emphasis">
            Gesamt: {{ formatElapsed(task.total_time_seconds) }}
          </span>
          <span v-if="task.active_timer && task.total_time_seconds > 0" class="text-caption text-medium-emphasis ml-2">
            (Gesamt: {{ formatElapsed(task.total_time_seconds + timerElapsed) }})
          </span>
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

        <!-- Timer: Start or Stop -->
        <v-btn v-if="!task.active_timer" variant="tonal" color="primary" @click="$emit('timer-start')">
          <v-icon start>mdi-play</v-icon>
          Starten
        </v-btn>
        <v-btn v-else variant="tonal" color="error" @click="$emit('timer-stop')">
          <v-icon start>mdi-stop</v-icon>
          Stoppen
        </v-btn>

        <v-btn v-if="canSkip" variant="tonal" @click="$emit('skip')">
          <v-icon start>mdi-debug-step-over</v-icon>
          Überspringen
        </v-btn>

        <v-btn v-if="canPostpone" variant="tonal" @click="$emit('postpone')">
          <v-icon start>mdi-calendar-clock</v-icon>
          Verschieben
        </v-btn>

        <v-btn variant="tonal" color="orange" @click="$emit('wait')">
          <v-icon start>mdi-clock-alert-outline</v-icon>
          Warten
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
import { computed, ref, watch, onUnmounted } from 'vue';
import { api } from '../composables/useApi.js';

const props = defineProps({
  modelValue: Boolean,
  task: Object,
  showSpaceName: { type: Boolean, default: true },
  showHistory: { type: Boolean, default: true },
  availableTasks: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue', 'complete', 'skip', 'postpone', 'edit', 'history', 'delete', 'wait', 'timer-start', 'timer-stop', 'items-changed']);

const stats = ref(null);

// Timer elapsed tracking
const timerElapsed = ref(0);
let timerInterval = null;

function startTimerTick() {
  stopTimerTick();
  if (props.task?.active_timer) {
    const started = new Date(props.task.active_timer.started_at);
    timerElapsed.value = Math.floor((Date.now() - started.getTime()) / 1000);
    timerInterval = setInterval(() => {
      timerElapsed.value = Math.floor((Date.now() - started.getTime()) / 1000);
    }, 1000);
  }
}

function stopTimerTick() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerElapsed.value = 0;
}

onUnmounted(stopTimerTick);

// Add item state
const addingItem = ref(false);
const newItem = ref(getDefaultNewItem());
const itemTypes = [
  { type: 'phone', icon: 'mdi-phone', label: 'Telefon' },
  { type: 'email', icon: 'mdi-email', label: 'E-Mail' },
  { type: 'url', icon: 'mdi-link', label: 'Link' },
  { type: 'task', icon: 'mdi-link-variant', label: 'Aufgabe' },
  { type: 'contact', icon: 'mdi-account', label: 'Person' }
];

function getDefaultNewItem() {
  return { item_type: 'phone', value: '', label: '', referenced_task_id: null, waiting: false, reminder_date: '' };
}

const canSaveItem = computed(() => {
  if (newItem.value.item_type === 'task') return !!newItem.value.referenced_task_id;
  return !!newItem.value.value.trim();
});

function getItemPlaceholder() {
  switch (newItem.value.item_type) {
    case 'phone': return 'Telefonnummer';
    case 'email': return 'E-Mail-Adresse';
    case 'url': return 'URL';
    default: return 'Wert';
  }
}

function cancelAddItem() {
  addingItem.value = false;
  newItem.value = getDefaultNewItem();
}

async function saveItem() {
  if (!canSaveItem.value) return;
  try {
    const payload = {
      item_type: newItem.value.item_type,
      value: newItem.value.value.trim() || undefined,
      label: newItem.value.label.trim() || undefined
    };

    if (newItem.value.item_type === 'task') {
      payload.referenced_task_id = newItem.value.referenced_task_id;
      payload.relationship = 'blocked_by';
      const refTask = props.availableTasks.find(t => t.id === newItem.value.referenced_task_id);
      payload.value = refTask?.title || String(newItem.value.referenced_task_id);
    }

    if (newItem.value.item_type === 'contact') {
      payload.waiting = newItem.value.waiting ? 1 : 0;
      payload.reminder_date = newItem.value.waiting ? newItem.value.reminder_date || null : null;
    }

    await api.post(`/spaces/${props.task.space_id}/tasks/${props.task.id}/items`, payload);
    cancelAddItem();
    emit('items-changed');
  } catch (error) {
    console.error('Failed to add item:', error);
  }
}

async function deleteItem(item) {
  try {
    await api.delete(`/spaces/${props.task.space_id}/tasks/${props.task.id}/items/${item.id}`);
    emit('items-changed');
  } catch (error) {
    console.error('Failed to delete item:', error);
  }
}

function getItemIcon(item) {
  switch (item.item_type) {
    case 'phone': return 'mdi-phone';
    case 'email': return 'mdi-email';
    case 'url': return 'mdi-link';
    case 'task': return 'mdi-link-variant';
    case 'contact': return item.waiting ? 'mdi-account-clock' : 'mdi-account';
    default: return 'mdi-attachment';
  }
}

function getItemColor(item) {
  if (item.item_type === 'task') {
    return item.referenced_task_status === 'completed' ? 'grey' : 'orange';
  }
  if (item.item_type === 'contact' && item.waiting) return 'orange';
  return 'primary';
}

function handleItemClick(item) {
  switch (item.item_type) {
    case 'phone':
      window.open(`tel:${item.value}`, '_self');
      break;
    case 'email':
      window.open(`mailto:${item.value}`, '_self');
      break;
    case 'url': {
      const url = item.value.startsWith('http') ? item.value : `https://${item.value}`;
      window.open(url, '_blank');
      break;
    }
  }
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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

  // Timer tick
  if (isOpen && props.task?.active_timer) {
    startTimerTick();
  } else {
    stopTimerTick();
  }

  // Reset add item form
  if (isOpen) {
    addingItem.value = false;
    newItem.value = getDefaultNewItem();
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
  return props.task.task_type === 'recurring' && props.task.recurrence_type === 'schedule';
});

const canPostpone = computed(() => {
  if (!props.task) return false;
  if (props.task.recurrence_type === 'one_time' && props.task.next_due_date) return true;
  if (props.task.task_type === 'recurring' && props.task.recurrence_type === 'interval') return true;
  return false;
});

function formatDate(dateStr) {
  if (!dateStr) return '';
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

.sheet-waiting-banner {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: #fff3e0;
  border-radius: 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #e65100;
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

/* Items */
.sheet-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.item-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 12px;
  background: #e8f5e9;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.item-chip:hover {
  background: #c8e6c9;
}

.item-label {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date {
  font-size: 11px;
  color: #9e9e9e;
}

.item-delete {
  opacity: 0.5;
}

.item-delete:hover {
  opacity: 1;
}

/* Add Item */
.sheet-add-item {
  margin-bottom: 12px;
}

.add-item-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  color: #9e9e9e;
  font-size: 12px;
  cursor: pointer;
  border: 1px dashed #e0e0e0;
  border-radius: 12px;
  width: fit-content;
}

.add-item-trigger:hover {
  color: #616161;
  border-color: #bdbdbd;
}

.add-item-form {
  padding: 12px;
  background: #fafafa;
  border-radius: 12px;
}

.add-item-types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.type-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 12px;
  background: #f0f0f0;
  font-size: 12px;
  cursor: pointer;
}

.type-chip.type-selected {
  background: #e3f2fd;
  color: #1976d2;
}

.add-item-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.item-input {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 13px;
  width: 100%;
  outline: none;
  background: white;
}

.item-input:focus {
  border-color: #1976d2;
}

.contact-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contact-waiting {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.add-item-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Timer */
.sheet-timer {
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #e3f2fd;
  border-radius: 12px;
}

.timer-elapsed {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
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
