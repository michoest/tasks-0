import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../composables/useApi.js';

export const useSpacesStore = defineStore('spaces', () => {
  const spaces = ref([]);
  const currentSpace = ref(null);
  const loading = ref(false);

  async function fetchSpaces() {
    loading.value = true;
    try {
      const res = await api.get('/spaces');
      spaces.value = res.spaces;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSpace(id) {
    loading.value = true;
    try {
      const res = await api.get(`/spaces/${id}`);
      currentSpace.value = res.space;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function createSpace(name) {
    const res = await api.post('/spaces', { name });
    spaces.value.unshift(res.space);
    return res.space;
  }

  async function updateSpace(id, name) {
    const res = await api.patch(`/spaces/${id}`, { name });
    const index = spaces.value.findIndex(w => w.id === id);
    if (index !== -1) {
      spaces.value[index] = res.space;
    }
    if (currentSpace.value?.id === id) {
      currentSpace.value = res.space;
    }
    return res.space;
  }

  async function deleteSpace(id) {
    await api.delete(`/spaces/${id}`);
    spaces.value = spaces.value.filter(w => w.id !== id);
    if (currentSpace.value?.id === id) {
      currentSpace.value = null;
    }
  }

  async function joinSpace(inviteCode) {
    const res = await api.post('/spaces/join', { inviteCode });
    spaces.value.unshift(res.space);
    return res.space;
  }

  async function leaveSpace(id) {
    await api.post(`/spaces/${id}/leave`);
    spaces.value = spaces.value.filter(w => w.id !== id);
    if (currentSpace.value?.id === id) {
      currentSpace.value = null;
    }
  }

  return {
    spaces,
    currentSpace,
    loading,
    fetchSpaces,
    fetchSpace,
    createSpace,
    updateSpace,
    deleteSpace,
    joinSpace,
    leaveSpace
  };
});
