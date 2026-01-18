import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth.js';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('./views/LoginView.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('./views/RegisterView.vue'),
    meta: { guest: true }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('./views/DashboardView.vue'),
    meta: { auth: true }
  },
  {
    path: '/task-list',
    name: 'task-list',
    component: () => import('./views/TaskListView.vue'),
    meta: { auth: true }
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('./views/CalendarView.vue'),
    meta: { auth: true }
  },
  {
    path: '/spaces',
    name: 'spaces',
    component: () => import('./views/SpacesView.vue'),
    meta: { auth: true }
  },
  {
    path: '/spaces/:id/settings',
    name: 'space-settings',
    component: () => import('./views/SpaceSettingsView.vue'),
    meta: { auth: true }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('./views/HistoryView.vue'),
    meta: { auth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/SettingsView.vue'),
    meta: { auth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Always scroll to top when navigating
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // Initial auth check
  if (!auth.checked) {
    await auth.checkSession();
  }

  // Redirect to login if auth required and not authenticated
  if (to.meta.auth && !auth.user) {
    return '/login';
  }

  // Redirect to home if guest route and authenticated
  if (to.meta.guest && auth.user) {
    return '/';
  }
});

export default router;
