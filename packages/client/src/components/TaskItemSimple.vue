<template>
  <v-list-item
    @click="$emit('click', task)"
    class="px-2"
  >
    <template #prepend>
      <v-checkbox
        :model-value="false"
        @click.stop="$emit('complete', task)"
        hide-details
        color="success"
        density="compact"
      />
    </template>

    <v-list-item-title class="text-body-2">
      {{ task.title }}
      <v-chip
        v-if="task.priority === 'high'"
        color="error"
        size="x-small"
        class="ml-1"
      >
        !
      </v-chip>
    </v-list-item-title>

    <v-list-item-subtitle class="text-caption">
      <v-chip
        v-if="task.category"
        :color="task.category.color"
        size="x-small"
        class="mr-1"
        variant="flat"
      >
        {{ task.category.name }}
      </v-chip>

      {{ formatDueDate(task) }}

      <span v-if="task.is_overdue" class="text-error ml-1">
        ({{ task.days_overdue }}d)
      </span>
    </v-list-item-subtitle>
  </v-list-item>
</template>

<script setup>
defineProps({
  task: {
    type: Object,
    required: true
  }
});

defineEmits(['complete', 'click']);

function formatDueDate(task) {
  if (!task.next_due_date) return 'Kein Datum';

  const date = new Date(task.next_due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);

  if (taskDate.getTime() === today.getTime()) {
    return 'Heute';
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (taskDate.getTime() === tomorrow.getTime()) {
    return 'Morgen';
  }

  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${dayNames[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}.`;
}
</script>
