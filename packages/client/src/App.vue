<template>
  <v-app>
    <SplashScreen v-if="authStore.loading" />
    <template v-else>
      <!-- Top App Bar - Same for all authenticated routes -->
      <v-app-bar v-if="authStore.user && !isGuestRoute" density="compact" elevation="0">
        <!-- App icon -->
        <div class="d-flex align-center pl-3">
          <svg width="32" height="32" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bg-app" x1="64" y1="32" x2="448" y2="480" gradientUnits="userSpaceOnUse">
                <stop stop-color="#6366F1"/>
                <stop offset="0.5" stop-color="#818CF8"/>
                <stop offset="1" stop-color="#3B82F6"/>
              </linearGradient>
              <filter id="shadow-app" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="10" stdDeviation="14" flood-opacity="0.25"/>
              </filter>
              <linearGradient id="cardGrad-app" x1="140" y1="130" x2="370" y2="390" gradientUnits="userSpaceOnUse">
                <stop stop-color="white" stop-opacity="0.95"/>
                <stop offset="1" stop-color="white" stop-opacity="0.85"/>
              </linearGradient>
              <linearGradient id="checkGrad-app" x1="170" y1="230" x2="260" y2="310" gradientUnits="userSpaceOnUse">
                <stop stop-color="#10B981"/>
                <stop offset="1" stop-color="#059669"/>
              </linearGradient>
              <linearGradient id="syncGrad-app" x1="250" y1="240" x2="370" y2="350" gradientUnits="userSpaceOnUse">
                <stop stop-color="#F59E0B"/>
                <stop offset="1" stop-color="#EF4444"/>
              </linearGradient>
            </defs>
            <rect x="32" y="32" width="448" height="448" rx="110" fill="url(#bg-app)"/>
            <g filter="url(#shadow-app)">
              <rect x="120" y="120" width="272" height="272" rx="64" fill="url(#cardGrad-app)"/>
            </g>
            <rect x="160" y="190" width="74" height="74" rx="18" fill="url(#checkGrad-app)"/>
            <path d="M177 228 L193 244 L220 214" stroke="white" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="250" y="204" width="112" height="18" rx="9" fill="#111827" fill-opacity="0.75"/>
            <rect x="250" y="240" width="90" height="14" rx="7" fill="#111827" fill-opacity="0.45"/>
            <g transform="scale(0.6) translate(180, 230)">
              <path d="M286 310 C286 276 312 252 346 252 C368 252 386 264 396 281" stroke="url(#syncGrad-app)" stroke-width="14" stroke-linecap="round" fill="none"/>
              <path d="M402 265 L404 292 L378 284" fill="url(#syncGrad-app)"/>
              <path d="M406 310 C406 344 380 368 346 368 C324 368 306 356 296 339" stroke="url(#syncGrad-app)" stroke-width="14" stroke-linecap="round" fill="none"/>
              <path d="M290 355 L288 328 L314 336" fill="url(#syncGrad-app)"/>
            </g>
            <circle cx="180" cy="322" r="16" fill="#111827" fill-opacity="0.7"/>
            <circle cx="212" cy="338" r="12" fill="#111827" fill-opacity="0.5"/>
            <path d="M64 160 C120 80 220 52 320 72 C380 84 420 110 448 148 C420 70 356 32 256 32 C140 32 74 90 64 160Z" fill="white" fill-opacity="0.12"/>
          </svg>
        </div>

        <v-spacer />

        <v-icon
          :icon="isOnline ? 'mdi-cloud-check' : 'mdi-cloud-off-outline'"
          :color="isOnline ? 'success' : 'error'"
          class="mx-3"
        />
      </v-app-bar>

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
