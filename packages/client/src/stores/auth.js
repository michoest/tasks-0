import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../composables/useApi.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const checked = ref(false);

  // Check if this is a cold start (first visit in this browser session)
  const isColdStart = !sessionStorage.getItem('app-session-started');
  const loading = ref(isColdStart);

  async function checkSession() {
    const startTime = Date.now();
    // Minimum splash time: 800ms for cold start, 0 for warm revisit
    const minSplashTime = isColdStart ? 800 : 0;

    try {
      const res = await api.get('/auth/me');
      user.value = res.user;
    } catch {
      user.value = null;
    } finally {
      // Mark session as started for future visits
      sessionStorage.setItem('app-session-started', 'true');

      // Ensure minimum display time for splash (only on cold start)
      if (isColdStart) {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minSplashTime - elapsedTime);
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
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
