<template>
  <v-bottom-sheet eager :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" scrollable>
    <v-card class="task-dialog-card">
      <!-- Header with title and close button on same line -->
      <div class="sheet-header">
        <v-text-field ref="titleRef" v-model="formData.title" placeholder="Aufgabe..." variant="plain"
          density="comfortable" hide-details autofocus class="title-input" />
        <v-btn icon="mdi-close" variant="text" size="small" @click="cancel" class="close-btn" />
      </div>

      <!-- Quick Options Row -->
      <div class="task-options">
        <!-- Space -->
        <div class="option-pill" :class="{ 'option-active': showSpace }" @click="toggleSection('space')">
          <v-icon size="18" :color="getSpaceColor()">mdi-folder</v-icon>
          <span class="option-label">{{ getSpaceName() }}</span>
        </div>

        <!-- Category -->
        <div class="option-pill" :class="{ 'option-active': showCategories }" @click="toggleSection('categories')">
          <v-icon size="18" :color="getCategoryColor()" :icon="getCategoryIcon()" />
          <span class="option-label">{{ getCategoryName() }}</span>
        </div>

        <!-- Due Date / Recurrence -->
        <div class="option-pill" :class="{ 'option-active': showRecurrence }" @click="toggleSection('recurrence')">
          <v-icon size="18" :color="getDateColor()">{{ getDateIcon() }}</v-icon>
          <span class="option-label">{{ getDateLabel() }}</span>
        </div>

        <!-- Progress -->
        <div class="option-pill" :class="{ 'option-active': showProgress || formData.progress !== null }" @click="toggleProgress">
          <v-icon size="16" :color="formData.progress !== null ? 'primary' : undefined">mdi-percent</v-icon>
          <span v-if="formData.progress !== null" class="option-label">{{ Math.round(formData.progress * 100) }}%</span>
        </div>

        <!-- Notes -->
        <div class="option-pill" :class="{ 'option-active': showNotes }" @click="showNotes = !showNotes">
          <v-icon size="16">mdi-note-text-outline</v-icon>
        </div>

        <!-- Active/Inactive Toggle (only when editing) -->
        <div v-if="task" class="option-pill" :class="{ 'option-inactive': formData.status === 'inactive' }" @click="toggleStatus">
          <v-icon size="16" :color="formData.status === 'inactive' ? 'warning' : 'success'">
            {{ formData.status === 'inactive' ? 'mdi-pause-circle' : 'mdi-play-circle' }}
          </v-icon>
          <span class="option-label">{{ formData.status === 'inactive' ? 'Inaktiv' : 'Aktiv' }}</span>
        </div>
      </div>

      <!-- Expandable Sections -->
      <div class="task-sections">
        <!-- Space Picker -->
        <v-expand-transition>
          <div v-show="showSpace" class="section-content">
            <div class="pill-grid">
              <div v-for="space in spaces" :key="space.id" class="selectable-pill"
                :class="{ 'pill-selected': formData.space_id === space.id }" @click="selectSpace(space.id)">
                <v-icon size="16" :color="space.personal_color || 'primary'">mdi-folder</v-icon>
                <span>{{ space.personal_name || space.name }}</span>
              </div>
            </div>
          </div>
        </v-expand-transition>

        <!-- Category Picker -->
        <v-expand-transition>
          <div v-show="showCategories" class="section-content">
            <div class="pill-grid">
              <div class="selectable-pill" :class="{ 'pill-selected': !formData.category_id }"
                @click="formData.category_id = null">
                <v-icon size="16" color="grey">mdi-tag-off</v-icon>
                <span>Keine</span>
              </div>
              <div v-for="cat in filteredCategories" :key="cat.id" class="selectable-pill"
                :class="{ 'pill-selected': formData.category_id === cat.id }" @click="formData.category_id = cat.id">
                <v-icon size="16" :color="cat.color">{{ cat.icon || 'mdi-tag' }}</v-icon>
                <span>{{ cat.name }}</span>
              </div>
            </div>
          </div>
        </v-expand-transition>

        <!-- Recurrence/Date Picker -->
        <v-expand-transition>
          <div v-show="showRecurrence" class="section-content">
            <!-- Type Pills -->
            <div class="pill-grid mb-3">
              <div class="selectable-pill" :class="{ 'pill-selected': formData.recurrence_type === 'no_date' }"
                @click="formData.recurrence_type = 'no_date'">
                <v-icon size="16">mdi-calendar-question</v-icon>
                <span>Irgendwann</span>
              </div>
              <div class="selectable-pill" :class="{ 'pill-selected': formData.recurrence_type === 'one_time' }"
                @click="formData.recurrence_type = 'one_time'">
                <v-icon size="16">mdi-calendar</v-icon>
                <span>Einmalig</span>
              </div>
              <div class="selectable-pill" :class="{ 'pill-selected': formData.recurrence_type === 'interval' }"
                @click="formData.recurrence_type = 'interval'">
                <v-icon size="16">mdi-refresh</v-icon>
                <span>Intervall</span>
              </div>
              <div class="selectable-pill" :class="{ 'pill-selected': formData.recurrence_type === 'schedule' }"
                @click="formData.recurrence_type = 'schedule'">
                <v-icon size="16">mdi-calendar-clock</v-icon>
                <span>Zeitplan</span>
              </div>
            </div>

            <!-- One-time: Date picker -->
            <div v-if="formData.recurrence_type === 'one_time'" class="date-section">
              <div class="quick-dates">
                <div class="date-chip" @click="setDate('today')">Heute</div>
                <div class="date-chip" @click="setDate('tomorrow')">Morgen</div>
                <div class="date-chip" @click="setDate('nextWeek')">Nächste Woche</div>
              </div>
              <input v-model="formData.next_due_date" type="date" class="date-input" />
            </div>

            <!-- Interval settings -->
            <div v-if="formData.recurrence_type === 'interval'" class="interval-section">
              <div class="interval-row">
                <span class="interval-label">Alle</span>
                <input v-model.number="formData.interval_days" type="number" min="1" class="interval-input" />
                <span class="interval-label">Tage</span>
                <div class="interval-toggle" :class="{ 'toggle-active': formData.interval_exclude_weekends }"
                  @click="formData.interval_exclude_weekends = !formData.interval_exclude_weekends">
                  <v-icon size="14">mdi-briefcase-off</v-icon>
                </div>
              </div>
              <div class="mt-2">
                <span class="text-caption text-medium-emphasis">Start:</span>
                <input v-model="formData.next_due_date" type="date" class="date-input ml-2" />
              </div>
            </div>

            <!-- Schedule settings -->
            <div v-if="formData.recurrence_type === 'schedule'" class="schedule-section">
              <div class="schedule-type-row">
                <div class="schedule-type-pill" :class="{ 'type-selected': scheduleType === 'weekly' }"
                  @click="scheduleType = 'weekly'">
                  Woche
                </div>
                <div class="schedule-type-pill" :class="{ 'type-selected': scheduleType === 'monthly' }"
                  @click="scheduleType = 'monthly'">
                  Monat
                </div>
              </div>

              <!-- Weekly days -->
              <div v-if="scheduleType === 'weekly'" class="weekday-grid">
                <div v-for="(day, idx) in ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']" :key="idx" class="weekday-chip"
                  :class="{ 'day-selected': scheduleWeekdays.includes(idx === 6 ? 0 : idx + 1) }"
                  @click="toggleWeekday(idx === 6 ? 0 : idx + 1)">
                  {{ day }}
                </div>
              </div>

              <!-- Monthly days -->
              <div v-if="scheduleType === 'monthly'" class="monthday-grid">
                <div v-for="day in 31" :key="day" class="monthday-chip"
                  :class="{ 'day-selected': scheduleMonthDays.includes(day) }" @click="toggleMonthDay(day)">
                  {{ day }}
                </div>
              </div>
            </div>

            <!-- Time option -->
            <div v-if="['one_time', 'interval', 'schedule'].includes(formData.recurrence_type)" class="time-section">
              <div class="time-toggle" :class="{ 'toggle-active': formData.has_specific_time }"
                @click="formData.has_specific_time = !formData.has_specific_time">
                <v-icon size="16">mdi-clock-outline</v-icon>
                <span>Uhrzeit</span>
              </div>
              <input v-if="formData.has_specific_time" v-model="formData.time_of_day" type="time" class="time-input" />
            </div>
          </div>
        </v-expand-transition>
      </div>

      <!-- Progress Section -->
      <v-expand-transition>
        <div v-show="showProgress" class="progress-section">
          <div class="progress-header">
            <span class="progress-label">Fortschritt</span>
            <span class="progress-value">{{ formData.progress !== null ? Math.round(formData.progress * 100) : 0 }}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            :value="formData.progress !== null ? Math.round(formData.progress * 100) : 0"
            @input="formData.progress = $event.target.value / 100"
            class="progress-slider"
          />
          <div class="progress-actions">
            <div class="progress-preset" @click="formData.progress = 0">0%</div>
            <div class="progress-preset" @click="formData.progress = 0.25">25%</div>
            <div class="progress-preset" @click="formData.progress = 0.5">50%</div>
            <div class="progress-preset" @click="formData.progress = 0.75">75%</div>
            <div class="progress-preset" @click="formData.progress = 1">100%</div>
            <div class="progress-remove" @click="removeProgress">
              <v-icon size="14">mdi-close</v-icon>
              Entfernen
            </div>
          </div>
        </div>
      </v-expand-transition>

      <!-- Notes Toggle -->

      <!-- <div
          class="notes-toggle"
          :class="{ 'toggle-active': showNotes }"
          @click="showNotes = !showNotes"
        >
          <v-icon size="16">mdi-note-text-outline</v-icon>
          <span>{{ formData.description ? 'Notiz bearbeiten' : 'Notiz hinzufügen' }}</span>
        </div> -->

      <v-expand-transition>
        <div v-show="showNotes" class="notes-section">
          <div class="notes-input-wrapper">
            <textarea v-model="formData.description" placeholder="Notizen..." class="notes-input" rows="3" />
          </div>
        </div>
      </v-expand-transition>


      <!-- Bottom Action -->
      <div class="sheet-footer">
        <v-btn block color="primary" size="large" :disabled="!formData.title.trim()" @click="save">
          {{ task ? 'Speichern' : 'Erstellen' }}
        </v-btn>
      </div>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  task: Object,
  categories: { type: Array, default: () => [] },
  spaces: { type: Array, default: () => [] },
  defaultSpaceId: Number,
  initialTitle: { type: String, default: '' },
  initialCategoryId: { type: Number, default: null }
});

const emit = defineEmits(['update:modelValue', 'save']);

const titleRef = ref(null);

// Expose method for synchronous focus (for iOS keyboard)
defineExpose({
  focusInputNow() {
    titleRef.value?.focus?.();
    // Fallback: focus the real input element
    const el = titleRef.value?.$el?.querySelector?.('input,textarea');
    el?.focus({ preventScroll: true });
  }
});

const showSpace = ref(false);
const showCategories = ref(false);
const showRecurrence = ref(false);
const showProgress = ref(false);
const showNotes = ref(false);

const scheduleType = ref('weekly');
const scheduleWeekdays = ref([]);
const scheduleMonthDays = ref([]);

const formData = ref(getDefaultFormData());

const filteredCategories = computed(() => {
  if (!formData.value.space_id) return props.categories;
  return props.categories.filter(cat => cat.space_id === formData.value.space_id);
});

function getDefaultFormData() {
  return {
    title: props.initialTitle || '',
    description: '',
    space_id: props.defaultSpaceId || props.spaces[0]?.id || null,
    category_id: null,
    recurrence_type: 'no_date',
    interval_days: 1,
    interval_exclude_weekends: false,
    has_specific_time: false,
    time_of_day: '09:00',
    next_due_date: getTodayDate(),
    progress: null,
    status: 'active'
  };
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function toggleSection(section) {
  if (section === 'space') {
    showSpace.value = !showSpace.value;
    showCategories.value = false;
    showRecurrence.value = false;
  } else if (section === 'categories') {
    showCategories.value = !showCategories.value;
    showSpace.value = false;
    showRecurrence.value = false;
  } else if (section === 'recurrence') {
    showRecurrence.value = !showRecurrence.value;
    showSpace.value = false;
    showCategories.value = false;
  }
}

function toggleProgress() {
  showProgress.value = !showProgress.value;
  // If enabling progress and it's null, set to 0
  if (showProgress.value && formData.value.progress === null) {
    formData.value.progress = 0;
  }
}

function removeProgress() {
  formData.value.progress = null;
  showProgress.value = false;
}

function toggleStatus() {
  formData.value.status = formData.value.status === 'active' ? 'inactive' : 'active';
}

function selectSpace(spaceId) {
  formData.value.space_id = spaceId;
  // Reset category if not in new space
  const catInSpace = filteredCategories.value.find(c => c.id === formData.value.category_id);
  if (!catInSpace) {
    formData.value.category_id = null;
  }
}

function getSpaceName() {
  const space = props.spaces.find(s => s.id === formData.value.space_id);
  return space?.personal_name || space?.name || 'Space';
}

function getSpaceColor() {
  const space = props.spaces.find(s => s.id === formData.value.space_id);
  return space?.personal_color || 'primary';
}

function getCategoryName() {
  if (!formData.value.category_id) return 'Kategorie';
  const cat = props.categories.find(c => c.id === formData.value.category_id);
  return cat?.name || 'Kategorie';
}

function getCategoryColor() {
  if (!formData.value.category_id) return 'grey';
  const cat = props.categories.find(c => c.id === formData.value.category_id);
  return cat?.color || 'grey';
}

function getCategoryIcon() {
  if (!formData.value.category_id) return 'mdi-tag';
  const cat = props.categories.find(c => c.id === formData.value.category_id);
  return cat?.icon || 'mdi-tag';
}

function getDateIcon() {
  switch (formData.value.recurrence_type) {
    case 'no_date': return 'mdi-calendar-question';
    case 'one_time': return 'mdi-calendar';
    case 'interval': return 'mdi-refresh';
    case 'schedule': return 'mdi-calendar-clock';
    default: return 'mdi-calendar';
  }
}

function getDateColor() {
  if (formData.value.recurrence_type === 'no_date') return 'grey';
  return 'primary';
}

function getDateLabel() {
  switch (formData.value.recurrence_type) {
    case 'no_date': return 'Irgendwann';
    case 'one_time':
      if (formData.value.next_due_date) {
        return formatShortDate(formData.value.next_due_date);
      }
      return 'Datum wählen';
    case 'interval':
      return `Alle ${formData.value.interval_days}d`;
    case 'schedule':
      if (scheduleType.value === 'weekly' && scheduleWeekdays.value.length > 0) {
        return `${scheduleWeekdays.value.length}x/Woche`;
      }
      if (scheduleType.value === 'monthly' && scheduleMonthDays.value.length > 0) {
        return `${scheduleMonthDays.value.length}x/Monat`;
      }
      return 'Zeitplan';
    default: return 'Datum';
  }
}

function formatShortDate(dateStr) {
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

function setDate(preset) {
  const today = new Date();
  if (preset === 'today') {
    formData.value.next_due_date = today.toISOString().split('T')[0];
  } else if (preset === 'tomorrow') {
    today.setDate(today.getDate() + 1);
    formData.value.next_due_date = today.toISOString().split('T')[0];
  } else if (preset === 'nextWeek') {
    today.setDate(today.getDate() + 7);
    formData.value.next_due_date = today.toISOString().split('T')[0];
  }
}

function toggleWeekday(day) {
  const idx = scheduleWeekdays.value.indexOf(day);
  if (idx === -1) {
    scheduleWeekdays.value.push(day);
  } else {
    scheduleWeekdays.value.splice(idx, 1);
  }
}

function toggleMonthDay(day) {
  const idx = scheduleMonthDays.value.indexOf(day);
  if (idx === -1) {
    scheduleMonthDays.value.push(day);
  } else {
    scheduleMonthDays.value.splice(idx, 1);
  }
}

// Watch for dialog open
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.task) {
      loadTask(props.task);
    } else {
      formData.value = getDefaultFormData();
      formData.value.title = props.initialTitle || '';
      formData.value.category_id = props.initialCategoryId || null;
      scheduleWeekdays.value = [];
      scheduleMonthDays.value = [];
      showSpace.value = false;
      showCategories.value = false;
      showRecurrence.value = false;
      showProgress.value = false;
      showNotes.value = false;
    }
  }
});

// Watch for initialTitle changes
watch(() => props.initialTitle, (newTitle) => {
  if (props.modelValue && !props.task) {
    formData.value.title = newTitle || '';
  }
});

function loadTask(task) {
  formData.value = {
    title: task.title || '',
    description: task.description || '',
    space_id: task.space_id || props.defaultSpaceId,
    category_id: task.category_id || null,
    recurrence_type: task.recurrence_type || 'no_date',
    interval_days: task.interval_days || 1,
    interval_exclude_weekends: !!task.interval_exclude_weekends,
    has_specific_time: !!task.has_specific_time,
    time_of_day: task.time_of_day || '09:00',
    next_due_date: task.next_due_date || getTodayDate(),
    progress: task.progress !== undefined ? task.progress : null,
    status: task.status || 'active'
  };

  if (task.schedule_pattern) {
    try {
      const pattern = JSON.parse(task.schedule_pattern);
      scheduleType.value = pattern.type || 'weekly';
      scheduleWeekdays.value = pattern.weekdays || [];
      scheduleMonthDays.value = pattern.days || [];
    } catch (e) {
      console.error('Failed to parse schedule:', e);
    }
  }

  showNotes.value = !!task.description;
  showProgress.value = task.progress !== null && task.progress !== undefined;
}

function cancel() {
  emit('update:modelValue', false);
}

function calculateScheduleNextDue(pattern) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (pattern.type === 'weekly' && pattern.weekdays?.length) {
    const sorted = [...pattern.weekdays].sort((a, b) => a - b);
    const current = new Date(today);
    for (let i = 0; i < 8; i++) {
      if (sorted.includes(current.getDay())) {
        return current.toISOString().split('T')[0];
      }
      current.setDate(current.getDate() + 1);
    }
  }

  if (pattern.type === 'monthly' && pattern.days?.length) {
    const sorted = [...pattern.days].sort((a, b) => a - b);
    const currentDay = today.getDate();
    const nextInMonth = sorted.find(d => d >= currentDay);
    if (nextInMonth) {
      const testDate = new Date(today.getFullYear(), today.getMonth(), nextInMonth);
      if (testDate.getDate() === nextInMonth) {
        return testDate.toISOString().split('T')[0];
      }
    }
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, sorted[0]);
    return nextMonth.toISOString().split('T')[0];
  }

  return today.toISOString().split('T')[0];
}

function save() {
  if (!formData.value.title.trim()) return;

  const payload = {
    title: formData.value.title.trim(),
    description: formData.value.description || null,
    space_id: formData.value.space_id,
    category_id: formData.value.category_id || null,
    recurrence_type: formData.value.recurrence_type,
    has_specific_time: formData.value.has_specific_time ? 1 : 0,
    time_of_day: formData.value.has_specific_time ? formData.value.time_of_day : null,
    progress: formData.value.progress,
    status: formData.value.status
  };

  if (formData.value.recurrence_type === 'no_date') {
    payload.next_due_date = null;
  } else if (formData.value.recurrence_type === 'one_time') {
    payload.next_due_date = formData.value.next_due_date;
  } else if (formData.value.recurrence_type === 'interval') {
    payload.interval_days = formData.value.interval_days;
    payload.interval_exclude_weekends = formData.value.interval_exclude_weekends ? 1 : 0;
    payload.next_due_date = formData.value.next_due_date;
  } else if (formData.value.recurrence_type === 'schedule') {
    const pattern = { type: scheduleType.value };
    if (scheduleType.value === 'weekly') {
      if (scheduleWeekdays.value.length === 0) {
        alert('Bitte mindestens einen Wochentag wählen');
        return;
      }
      pattern.weekdays = scheduleWeekdays.value.sort((a, b) => a - b);
    } else {
      if (scheduleMonthDays.value.length === 0) {
        alert('Bitte mindestens einen Tag wählen');
        return;
      }
      pattern.days = scheduleMonthDays.value.sort((a, b) => a - b);
    }
    payload.schedule_pattern = JSON.stringify(pattern);
    payload.next_due_date = calculateScheduleNextDue(pattern);
  }

  emit('save', payload);
  cancel();
}
</script>

<style scoped>
.task-dialog-card {
  border-radius: 24px 24px 0 0 !important;
  max-height: 85vh;
  overflow-y: auto;
}

.sheet-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 0 20px;
}

.sheet-header .title-input {
  flex: 1;
}

.close-btn {
  flex-shrink: 0;
}

.sheet-footer {
  padding: 16px 20px 20px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
}

.title-input {
  font-size: 20px;
  font-weight: 500;
}

.title-input :deep(.v-field__input) {
  padding: 8px 0;
}

/* Options Row */
.task-options {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  flex-wrap: wrap;
}

.option-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s;
}

.option-pill:hover {
  background: #eeeeee;
}

.option-active {
  background: #e3f2fd;
}

.option-inactive {
  background: #fff3e0;
}

.option-label {
  font-size: 14px;
  color: #424242;
}

/* Sections */
.task-sections {
  padding: 0 20px;
}

.section-content {
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;
}

.pill-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selectable-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 16px;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.selectable-pill:hover {
  background: #f0f0f0;
}

.pill-selected {
  background: #e3f2fd;
  border-color: #1976d2;
  color: #1976d2;
}

/* Date Section */
.date-section {
  margin-top: 12px;
}

.quick-dates {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.date-chip {
  padding: 6px 14px;
  border-radius: 16px;
  background: #f5f5f5;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.date-chip:hover {
  background: #e0e0e0;
}

.date-input {
  padding: 10px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  font-size: 14px;
  width: 100%;
  outline: none;
}

.date-input:focus {
  border-color: #1976d2;
}

/* Interval Section */
.interval-section {
  margin-top: 12px;
}

.interval-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.interval-label {
  font-size: 14px;
  color: #616161;
}

.interval-input {
  width: 60px;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  text-align: center;
  outline: none;
}

.interval-input:focus {
  border-color: #1976d2;
}

.interval-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f5f5f5;
  cursor: pointer;
  margin-left: auto;
}

.interval-toggle.toggle-active {
  background: #e3f2fd;
  color: #1976d2;
}

/* Schedule Section */
.schedule-section {
  margin-top: 12px;
}

.schedule-type-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.schedule-type-pill {
  padding: 8px 20px;
  border-radius: 20px;
  background: #f5f5f5;
  font-size: 13px;
  cursor: pointer;
}

.schedule-type-pill.type-selected {
  background: #1976d2;
  color: white;
}

.weekday-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.weekday-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  border-radius: 10px;
  background: #f5f5f5;
  font-size: 13px;
  cursor: pointer;
}

.weekday-chip.day-selected {
  background: #1976d2;
  color: white;
}

.monthday-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.monthday-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  border-radius: 8px;
  background: #f5f5f5;
  font-size: 12px;
  cursor: pointer;
}

.monthday-chip.day-selected {
  background: #1976d2;
  color: white;
}

/* Time Section */
.time-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.time-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 16px;
  background: #f5f5f5;
  font-size: 13px;
  cursor: pointer;
}

.time-toggle.toggle-active {
  background: #e3f2fd;
  color: #1976d2;
}

.time-input {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
}

.time-input:focus {
  border-color: #1976d2;
}

/* Notes Section */
.notes-section {
  padding: 12px 20px 20px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
}

.notes-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 16px;
  background: #f5f5f5;
  font-size: 13px;
  cursor: pointer;
  width: fit-content;
}

.notes-toggle.toggle-active {
  background: #e3f2fd;
  color: #1976d2;
}

.notes-input-wrapper {
  margin-top: 12px;
}

.notes-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
}

.notes-input:focus {
  border-color: #1976d2;
}

/* Progress Section */
.progress-section {
  padding: 12px 20px;
  border-top: 1px solid #f0f0f0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 13px;
  color: #616161;
}

.progress-value {
  font-size: 14px;
  font-weight: 500;
  color: #1976d2;
}

.progress-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #e0e0e0;
  border-radius: 3px;
  outline: none;
  margin-bottom: 12px;
}

.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #1976d2;
  border-radius: 50%;
  cursor: pointer;
}

.progress-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #1976d2;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.progress-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.progress-preset {
  padding: 4px 12px;
  border-radius: 12px;
  background: #f5f5f5;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.progress-preset:hover {
  background: #e0e0e0;
}

.progress-remove {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 12px;
  background: #ffebee;
  color: #c62828;
  font-size: 12px;
  cursor: pointer;
  margin-left: auto;
}

.progress-remove:hover {
  background: #ffcdd2;
}
</style>
