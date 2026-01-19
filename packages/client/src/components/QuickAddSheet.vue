<template>
  <v-bottom-sheet eager :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <v-card class="quick-add-card">
      <div class="quick-add-content">
        <v-text-field
          ref="inputRef"
          v-model="title"
          placeholder="Was liegt dir auf dem Herzen?"
          variant="plain"
          density="comfortable"
          hide-details
          autofocus
          class="quick-add-input"
          @keydown.enter="addToInbox"
        />

        <div class="quick-add-actions">
          <v-btn
            variant="text"
            color="medium-emphasis"
            @click="openFullDialog"
          >
          <v-icon start>mdi-tag-plus</v-icon>
          </v-btn>

          <v-btn
            variant="tonal"
            color="primary"
            :disabled="!title.trim()"
            @click="addToInbox"
            icon="mdi-inbox-arrow-down"
          >
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  defaultSpaceId: {
    type: Number,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'add-inbox', 'open-full']);

const inputRef = ref(null);
const title = ref('');

// Expose method for synchronous focus (for iOS keyboard)
defineExpose({
  focusInputNow() {
    inputRef.value?.focus?.();
    // Fallback: focus the real input element
    const el = inputRef.value?.$el?.querySelector?.('input,textarea');
    el?.focus({ preventScroll: true });
  }
});

function addToInbox() {
  if (!title.value.trim()) return;

  emit('add-inbox', {
    title: title.value.trim(),
    space_id: props.defaultSpaceId
  });

  title.value = '';
  emit('update:modelValue', false);
}

function openFullDialog() {
  const currentTitle = title.value.trim();
  title.value = '';
  emit('update:modelValue', false);
  emit('open-full', currentTitle);
}
</script>

<style scoped>
.quick-add-card {
  border-radius: 24px 24px 0 0 !important;
  overflow: hidden;
}

.quick-add-content {
  padding: 20px 20px 16px;
}

.quick-add-input {
  font-size: 18px;
}

.quick-add-input :deep(.v-field__input) {
  padding: 8px 0;
}

.quick-add-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
</style>
