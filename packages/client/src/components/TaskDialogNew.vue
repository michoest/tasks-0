<template>
  <v-bottom-sheet :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" scrollable>
    <v-card>
      <v-card-text class="pa-4">
        <v-form ref="formRef" @submit.prevent="save">
          <!-- Title - Always visible -->
          <v-text-field
            v-model="formData.title"
            label="Neue Aufgabe"
            variant="outlined"
            autofocus
            :rules="[v => !!v || 'Titel ist erforderlich']"
            hide-details="auto"
            @keydown.enter.prevent="save"
          />

          <!-- Quick settings row -->
          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-chip
              variant="outlined"
              @click="showSpace = !showSpace"
            >
              <v-icon start icon="mdi-folder" />
              {{ selectedSpaceName }}
            </v-chip>

            <v-chip
              :color="formData.category_id ? getCategoryById(formData.category_id)?.color : 'grey'"
              variant="outlined"
              @click="showCategories = !showCategories"
            >
              <v-icon start :icon="formData.category_id ? getCategoryById(formData.category_id)?.icon : 'mdi-tag'" />
              {{ formData.category_id ? getCategoryById(formData.category_id)?.name : 'Kategorie' }}
            </v-chip>

            <v-chip
              variant="outlined"
              @click="showRecurrence = !showRecurrence"
            >
              <v-icon start icon="mdi-refresh" />
              {{ getRecurrenceLabel() }}
            </v-chip>

            <v-chip
              variant="outlined"
              @click="showAdvanced = !showAdvanced"
            >
              <v-icon start icon="mdi-note-text-outline" />
              Notizen
            </v-chip>
          </div>

          <!-- Space picker -->
          <v-expand-transition>
            <div v-show="showSpace" class="mt-3">
              <div class="text-caption mb-2">Space</div>
              <v-chip-group v-model="formData.space_id" column mandatory>
                <v-chip
                  v-for="space in spaces"
                  :key="space.id"
                  :value="space.id"
                  variant="outlined"
                  filter
                >
                  <v-icon start icon="mdi-folder" />
                  {{ space.name }}
                </v-chip>
              </v-chip-group>
            </div>
          </v-expand-transition>

          <!-- Category picker -->
          <v-expand-transition>
            <div v-show="showCategories" class="mt-3">
              <div class="text-caption mb-2">Kategorie</div>
              <v-chip-group v-model="formData.category_id" column mandatory>
                <v-chip
                  v-for="cat in filteredCategories"
                  :key="cat.id"
                  :value="cat.id"
                  :color="cat.color"
                  variant="outlined"
                  filter
                >
                  <v-icon start :icon="cat.icon" />
                  {{ cat.name }}
                </v-chip>
              </v-chip-group>
            </div>
          </v-expand-transition>

          <!-- Recurrence settings -->
          <v-expand-transition>
            <div v-show="showRecurrence" class="mt-3">
              <div class="text-caption mb-2">Wiederholung</div>

              <v-chip-group v-model="formData.recurrence_type" column mandatory>
                <v-chip value="no_date" variant="outlined" filter>Ohne Datum</v-chip>
                <v-chip value="one_time" variant="outlined" filter>Einmalig</v-chip>
                <v-chip value="interval" variant="outlined" filter>Alle X Tage</v-chip>
                <v-chip value="schedule" variant="outlined" filter>Zeitplan</v-chip>
                <v-chip value="inactive" variant="outlined" filter>Inaktiv</v-chip>
              </v-chip-group>

              <!-- One-time date -->
              <v-text-field
                v-if="formData.recurrence_type === 'one_time'"
                v-model="formData.next_due_date"
                label="Fällig am"
                type="date"
                variant="outlined"
                hide-details
                class="mt-2"
              />

              <!-- Interval settings -->
              <div v-if="formData.recurrence_type === 'interval'" class="mt-2">
                <v-text-field
                  v-model.number="formData.interval_days"
                  label="Alle X Tage"
                  type="number"
                  min="1"
                  variant="outlined"
                  hide-details
                />
                <v-checkbox
                  v-model="formData.interval_exclude_weekends"
                  label="Wochenenden ausschließen"
                  hide-details
                  density="compact"
                  class="mt-2"
                />
                <v-text-field
                  v-model="formData.next_due_date"
                  label="Erstes Fälligkeitsdatum"
                  type="date"
                  variant="outlined"
                  hide-details
                  class="mt-2"
                />
              </div>

              <!-- Schedule settings -->
              <div v-if="formData.recurrence_type === 'schedule'" class="mt-2">
                <v-chip-group v-model="scheduleType" column mandatory>
                  <v-chip value="weekly" variant="outlined" filter>Wöchentlich</v-chip>
                  <v-chip value="monthly" variant="outlined" filter>Monatlich</v-chip>
                </v-chip-group>

                <!-- Weekly -->
                <div v-if="scheduleType === 'weekly'" class="mt-2">
                  <div class="text-caption mb-2">Wochentage</div>
                  <v-chip-group v-model="scheduleWeekdays" multiple column>
                    <v-chip v-for="(day, index) in weekdayNames" :key="index" :value="index" variant="outlined" filter>
                      {{ day }}
                    </v-chip>
                  </v-chip-group>
                </div>

                <!-- Monthly -->
                <div v-if="scheduleType === 'monthly'" class="mt-2">
                  <div class="text-caption mb-2">Monatstage</div>
                  <v-chip-group v-model="scheduleMonthDays" multiple column>
                    <v-chip v-for="day in 31" :key="day" :value="day" variant="outlined" filter size="small">
                      {{ day }}.
                    </v-chip>
                  </v-chip-group>
                </div>
              </div>

              <!-- Time-sensitive option (only for interval, schedule, one_time) -->
              <div v-if="['interval', 'schedule', 'one_time'].includes(formData.recurrence_type)" class="mt-3">
                <v-checkbox
                  v-model="formData.has_specific_time"
                  label="Zu einer bestimmten Uhrzeit"
                  hide-details
                  density="compact"
                />

                <v-text-field
                  v-if="formData.has_specific_time"
                  v-model="formData.time_of_day"
                  label="Uhrzeit"
                  type="time"
                  variant="outlined"
                  hide-details
                  class="mt-2"
                />
              </div>

              <!-- Inactive has no settings -->
            </div>
          </v-expand-transition>

          <!-- Notes section -->
          <v-expand-transition>
            <div v-show="showAdvanced" class="mt-3">
              <v-textarea
                v-model="formData.description"
                label="Notizen"
                variant="outlined"
                rows="2"
                hide-details
              />
            </div>
          </v-expand-transition>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-4 pb-4">
        <v-btn variant="text" color="error" @click="cancel">Abbrechen</v-btn>
        <v-spacer />
        <v-btn variant="text" color="primary" @click="save">
          {{ task ? 'Speichern' : 'Erstellen' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  task: {
    type: Object,
    default: null
  },
  categories: {
    type: Array,
    default: () => []
  },
  spaces: {
    type: Array,
    default: () => []
  },
  defaultSpaceId: {
    type: Number,
    default: null
  },
  spaceMembers: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'save']);

const formRef = ref(null);
const showSpace = ref(false);
const showCategories = ref(false);
const showRecurrence = ref(false);
const showAdvanced = ref(false);
const scheduleType = ref('weekly');
const scheduleWeekdays = ref([]);
const scheduleMonthDays = ref([]);
const scheduleComment = ref('');

const weekdayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const formData = ref(getDefaultFormData());

// Filter categories by selected space
const filteredCategories = computed(() => {
  if (!formData.value.space_id) return props.categories;
  return props.categories.filter(cat => cat.space_id === formData.value.space_id);
});

// Get selected space name
const selectedSpaceName = computed(() => {
  const space = props.spaces.find(s => s.id === formData.value.space_id);
  return space?.name || 'Space';
});

// Watch for space changes and reset category
watch(() => formData.value.space_id, (newSpaceId, oldSpaceId) => {
  if (newSpaceId !== oldSpaceId && !props.task) {
    // Reset category to first available category in new space
    const firstCategory = filteredCategories.value[0];
    formData.value.category_id = firstCategory?.id || null;
  }
});

function getDefaultFormData() {
  return {
    title: '',
    description: '',
    space_id: props.defaultSpaceId || props.spaces[0]?.id || null,
    category_id: props.categories[0]?.id || null,
    priority: 'medium',
    effort: 'medium',
    assigned_to: [],
    recurrence_type: 'no_date',
    interval_days: 1,
    interval_exclude_weekends: false,
    schedule_pattern: null,
    has_specific_time: false,
    time_of_day: '09:00',
    grace_period_minutes: 120,
    next_due_date: getTodayDate()
  };
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const day = dayNames[date.getDay()];
  return `${day}, ${date.getDate()}.${date.getMonth() + 1}.`;
}

function getCategoryById(id) {
  return props.categories.find(c => c.id === id);
}

/**
 * Calculate the next due date for a schedule-based task
 * @param {Object} pattern - Schedule pattern {type: 'weekly'|'monthly', weekdays?: number[], days?: number[]}
 * @returns {string} - Next due date in YYYY-MM-DD format
 */
function calculateScheduleNextDue(pattern) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (pattern.type === 'weekly') {
    return calculateWeeklyNextDue(pattern.weekdays, today);
  }

  if (pattern.type === 'monthly') {
    return calculateMonthlyNextDue(pattern.days, today);
  }

  // Fallback to today
  return today.toISOString().split('T')[0];
}

/**
 * Calculate next occurrence for weekly pattern
 */
function calculateWeeklyNextDue(weekdays, fromDate) {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const current = new Date(fromDate);

  // Check today and next 7 days to find next matching weekday
  for (let i = 0; i < 8; i++) {
    const day = current.getDay();
    if (sorted.includes(day)) {
      return current.toISOString().split('T')[0];
    }
    current.setDate(current.getDate() + 1);
  }

  // Fallback (should not happen with valid weekdays)
  return fromDate.toISOString().split('T')[0];
}

/**
 * Calculate next occurrence for monthly pattern
 */
function calculateMonthlyNextDue(days, fromDate) {
  const sorted = [...days].sort((a, b) => a - b);
  const current = new Date(fromDate);
  const currentDay = current.getDate();

  // Try to find a day in the current month (today or later)
  const nextInMonth = sorted.find(d => d >= currentDay);
  if (nextInMonth) {
    const testDate = new Date(current.getFullYear(), current.getMonth(), nextInMonth);
    // Check if the date is valid (e.g., Feb 31 would be invalid)
    if (testDate.getDate() === nextInMonth) {
      return testDate.toISOString().split('T')[0];
    }
  }

  // Otherwise, use first day of next month
  current.setMonth(current.getMonth() + 1);

  for (const day of sorted) {
    const testDate = new Date(current.getFullYear(), current.getMonth(), day);
    // Check if the date is valid
    if (testDate.getDate() === day) {
      return testDate.toISOString().split('T')[0];
    }
  }

  // Fallback
  return fromDate.toISOString().split('T')[0];
}

function getRecurrenceLabel() {
  if (formData.value.recurrence_type === 'no_date') return 'Ohne Datum';
  if (formData.value.recurrence_type === 'one_time') {
    if (formData.value.next_due_date) {
      return formatDate(formData.value.next_due_date);
    }
    return 'Einmalig';
  }
  if (formData.value.recurrence_type === 'interval') {
    const days = formData.value.interval_days || 1;
    return `Alle ${days} Tag${days > 1 ? 'e' : ''}`;
  }
  if (formData.value.recurrence_type === 'schedule') {
    if (scheduleType.value === 'weekly') {
      return `Wöchentlich (${scheduleWeekdays.value.length} Tage)`;
    }
    return `Monatlich (${scheduleMonthDays.value.length} Tage)`;
  }
  if (formData.value.recurrence_type === 'inactive') return 'Inaktiv';
  return 'Wiederholung';
}

// Watch for dialog open/close to reset form when creating new task
watch(() => props.modelValue, (newVal) => {
  if (newVal && !props.task) {
    // Creating new task - reset form
    formData.value = getDefaultFormData();
    showCategories.value = false;
    showRecurrence.value = false;
    showAdvanced.value = false;
    scheduleWeekdays.value = [];
    scheduleMonthDays.value = [];
  }
});

// Load task data when editing
watch(() => props.task, (newTask) => {
  if (newTask) {
    // Parse assigned_to field (could be null, empty string, or comma-separated IDs)
    let assignedTo = [];
    if (newTask.assigned_to && typeof newTask.assigned_to === 'string' && newTask.assigned_to.trim()) {
      assignedTo = newTask.assigned_to.split(',').map(Number);
    }

    formData.value = {
      title: newTask.title || '',
      description: newTask.description || '',
      space_id: newTask.space_id || props.defaultSpaceId || props.spaces[0]?.id || null,
      category_id: newTask.category_id || props.categories[0]?.id || null,
      priority: newTask.priority || 'medium',
      effort: newTask.effort || 'medium',
      assigned_to: assignedTo,
      recurrence_type: newTask.recurrence_type || 'one_time',
      interval_days: newTask.interval_days || 1,
      interval_exclude_weekends: !!newTask.interval_exclude_weekends,
      schedule_pattern: newTask.schedule_pattern || null,
      has_specific_time: !!newTask.has_specific_time,
      time_of_day: newTask.time_of_day || '09:00',
      grace_period_minutes: newTask.grace_period_minutes || 120,
      next_due_date: newTask.next_due_date || getTodayDate()
    };

    // Parse schedule pattern if present
    if (newTask.schedule_pattern) {
      try {
        const pattern = JSON.parse(newTask.schedule_pattern);
        if (pattern.type === 'weekly') {
          scheduleType.value = 'weekly';
          scheduleWeekdays.value = pattern.weekdays || [];
        } else if (pattern.type === 'monthly') {
          scheduleType.value = 'monthly';
          scheduleMonthDays.value = pattern.days || [];
        }
        scheduleComment.value = pattern.comment || '';
      } catch (e) {
        console.error('Failed to parse schedule pattern:', e);
      }
    }

    // Auto-expand relevant sections when editing
    if (newTask.category_id) showCategories.value = false;
    if (newTask.recurrence_type !== 'one_time') showRecurrence.value = true;
    if (newTask.priority !== 'medium' || newTask.effort !== 'medium' || newTask.has_specific_time) {
      showAdvanced.value = true;
    }
  }
}, { immediate: true });

function cancel() {
  emit('update:modelValue', false);
  // Reset form after close animation
  setTimeout(() => {
    formData.value = getDefaultFormData();
    showCategories.value = false;
    showRecurrence.value = false;
    showAdvanced.value = false;
    scheduleWeekdays.value = [];
    scheduleMonthDays.value = [];
  }, 300);
}

async function save() {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  // Build the payload
  const payload = {
    title: formData.value.title,
    description: formData.value.description || null,
    space_id: formData.value.space_id,
    category_id: formData.value.category_id || null,
    priority: formData.value.priority,
    effort: formData.value.effort,
    assigned_to: null, // Simplified for now
    recurrence_type: formData.value.recurrence_type,
    has_specific_time: formData.value.has_specific_time ? 1 : 0,
    time_of_day: formData.value.has_specific_time ? formData.value.time_of_day : null,
    grace_period_minutes: formData.value.has_specific_time ? formData.value.grace_period_minutes : null
  };

  // Add type-specific fields
  if (formData.value.recurrence_type === 'no_date') {
    // No date tasks have no next_due_date
    payload.next_due_date = null;
  } else if (formData.value.recurrence_type === 'one_time') {
    payload.next_due_date = formData.value.next_due_date;
  } else if (formData.value.recurrence_type === 'interval') {
    payload.interval_days = formData.value.interval_days;
    payload.interval_exclude_weekends = formData.value.interval_exclude_weekends ? 1 : 0;
    payload.next_due_date = formData.value.next_due_date;
  } else if (formData.value.recurrence_type === 'schedule') {
    // Build schedule pattern
    const pattern = {
      type: scheduleType.value,
      comment: scheduleComment.value || null
    };

    if (scheduleType.value === 'weekly') {
      if (scheduleWeekdays.value.length === 0) {
        alert('Bitte mindestens einen Wochentag auswählen');
        return;
      }
      pattern.weekdays = scheduleWeekdays.value.sort((a, b) => a - b);
    } else if (scheduleType.value === 'monthly') {
      if (scheduleMonthDays.value.length === 0) {
        alert('Bitte mindestens einen Monatstag auswählen');
        return;
      }
      pattern.days = scheduleMonthDays.value.sort((a, b) => a - b);
    }

    payload.schedule_pattern = JSON.stringify(pattern);
    // Calculate initial next_due_date for schedule tasks
    payload.next_due_date = calculateScheduleNextDue(pattern);
  } else if (formData.value.recurrence_type === 'inactive') {
    // Inactive tasks have no next_due_date
    payload.next_due_date = null;
  }

  emit('save', payload);
  cancel();
}
</script>
