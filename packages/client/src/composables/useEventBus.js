import { ref } from 'vue';

const events = ref({});

export function useEventBus() {
  function emit(event, data) {
    if (!events.value[event]) {
      events.value[event] = [];
    }
    events.value[event].forEach(callback => callback(data));
  }

  function on(event, callback) {
    if (!events.value[event]) {
      events.value[event] = [];
    }
    events.value[event].push(callback);
  }

  function off(event, callback) {
    if (!events.value[event]) return;
    events.value[event] = events.value[event].filter(cb => cb !== callback);
  }

  return {
    emit,
    on,
    off
  };
}
