import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../composables/useApi.js';

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref([]);
  const loading = ref(false);

  async function fetchTasks(spaceId) {
    loading.value = true;
    try {
      const res = await api.get(`/spaces/${spaceId}/tasks`);
      tasks.value = res.tasks;
      return res.tasks;
    } finally {
      loading.value = false;
    }
  }

  async function createTask(spaceId, data) {
    const res = await api.post(`/spaces/${spaceId}/tasks`, data);
    tasks.value.unshift(res.task);
    return res.task;
  }

  async function updateTask(spaceId, taskId, data) {
    const res = await api.patch(`/spaces/${spaceId}/tasks/${taskId}`, data);
    const index = tasks.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasks.value[index] = res.task;
    }
    return res.task;
  }

  async function deleteTask(spaceId, taskId) {
    await api.delete(`/spaces/${spaceId}/tasks/${taskId}`);
    tasks.value = tasks.value.filter(t => t.id !== taskId);
  }

  async function completeTask(spaceId, taskId, data = {}) {
    const res = await api.post(`/spaces/${spaceId}/tasks/${taskId}/complete`, data);
    const index = tasks.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasks.value[index] = res.task;
    }
    return res.task;
  }

  async function skipTask(spaceId, taskId, data = {}) {
    const res = await api.post(`/spaces/${spaceId}/tasks/${taskId}/skip`, data);
    const index = tasks.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasks.value[index] = res.task;
    }
    return res.task;
  }

  function handleSSEMessage({ type, data }) {
    if (type === 'task_created') {
      const exists = tasks.value.find(t => t.id === data.id);
      if (!exists) {
        tasks.value.unshift(data);
      }
    } else if (type === 'task_updated' || type === 'task_completed' || type === 'task_skipped') {
      const index = tasks.value.findIndex(t => t.id === data.id);
      if (index !== -1) {
        tasks.value[index] = data;
      }
    } else if (type === 'task_deleted') {
      tasks.value = tasks.value.filter(t => t.id !== data.id);
    }
  }

  return {
    tasks,
    loading,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    skipTask,
    handleSSEMessage
  };
});
