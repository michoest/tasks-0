import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../composables/useApi.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const checked = ref(false);
  const loading = ref(true);

  async function checkSession() {
    const startTime = Date.now();

    try {
      const res = await api.get('/auth/me');
      user.value = res.user;
    } catch {
      user.value = null;
    } finally {
      // Ensure minimum 2 seconds display time for splash screen
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsedTime);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      checked.value = true;
      loading.value = false;
    }
  }

  async function register(email, password) {
    const res = await api.post('/auth/register', { email, password });
    user.value = res.user;
    return res.user;
  }

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    user.value = res.user;
    return res.user;
  }

  async function logout() {
    await api.post('/auth/logout');
    user.value = null;
  }

  return {
    user,
    checked,
    loading,
    checkSession,
    register,
    login,
    logout
  };
});
