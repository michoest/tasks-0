<template>
  <v-app>
    <!-- Splash screen with fade-out transition -->
    <Transition name="splash-fade">
      <SplashScreen v-if="authStore.loading" />
    </Transition>

    <template v-if="!authStore.loading">
      <!-- Connection Status Bar - Flat gradient bar -->
      <div v-if="authStore.user && !isGuestRoute" class="connection-status-bar" :class="{ 'status-online': isOnline, 'status-offline': !isOnline }"></div>

      <router-view />

      <!-- Bottom Navigation - Only show on authenticated routes -->
      <v-bottom-navigation v-if="authStore.user && !isGuestRoute" v-model="activeTab" color="primary" bg-color="surface"
        grow>
        <v-btn value="dashboard" @click="router.push('/dashboard')">
          <v-icon>mdi-checkbox-multiple-marked-circle-outline</v-icon>
        </v-btn>

        <v-btn value="task-list" @click="router.push('/task-list')">
          <v-icon>mdi-format-list-checkbox</v-icon>
        </v-btn>

        <v-btn value="calendar" @click="router.push('/calendar')">
          <v-icon>mdi-calendar</v-icon>
        </v-btn>

        <v-btn value="history" @click="router.push('/history')">
          <v-icon>mdi-chart-line</v-icon>
        </v-btn>

        <v-btn value="settings" @click="router.push('/settings')">
          <v-icon>mdi-cog</v-icon>
        </v-btn>
      </v-bottom-navigation>

    </template>
  </v-app>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth.js';
import { useEventBus } from './composables/useEventBus.js';
import SplashScreen from './components/SplashScreen.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const eventBus = useEventBus();

const activeTab = ref('dashboard');
const isOnline = ref(navigator.onLine);

// Monitor online/offline status
window.addEventListener('online', () => {
  isOnline.value = true;
});
window.addEventListener('offline', () => {
  isOnline.value = false;
});

// Check if current route is a guest route (login/register)
const isGuestRoute = computed(() => route.meta.guest);

// Update active tab based on route
watch(() => route.path, (path) => {
  if (path === '/dashboard' || path === '/') {
    activeTab.value = 'dashboard';
  } else if (path === '/task-list') {
    activeTab.value = 'task-list';
  } else if (path === '/calendar') {
    activeTab.value = 'calendar';
  } else if (path === '/history') {
    activeTab.value = 'history';
  } else if (path === '/settings' || path === '/spaces' || path.startsWith('/spaces/')) {
    activeTab.value = 'settings';
  }
}, { immediate: true });

// Event handler for app bar refresh action
function refreshDashboard() {
  eventBus.emit('dashboard:refresh');
}
</script>

<style scoped>
.connection-status-bar {
  height: 5px;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  transition: background 0.3s ease;
}

.status-online {
  background: linear-gradient(90deg, #10B981, #34D399, #6EE7B7, #34D399, #10B981);
  background-size: 200% 100%;
  animation: shimmer 3s ease infinite;
}

.status-offline {
  background: linear-gradient(90deg, #EF4444, #F87171, #FCA5A5, #F87171, #EF4444);
  background-size: 200% 100%;
  animation: shimmer 2s ease infinite;
}

@keyframes shimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Splash screen fade-out transition */
.splash-fade-leave-active {
  transition: opacity 0.3s ease-out;
}

.splash-fade-leave-to {
  opacity: 0;
}
</style>
