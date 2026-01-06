import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

import App from './App.vue';
import router from './router.js';

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#6366F1',      // Modern Indigo
          secondary: '#818CF8',    // Light Indigo
          success: '#10B981',      // Fresh Emerald
          warning: '#F59E0B',      // Warm Amber
          error: '#EF4444',        // Clear Red
          info: '#3B82F6',         // Bright Blue
          background: '#F9FAFB',   // Light Gray
          surface: '#FFFFFF',
        },
      },
    },
  },
  defaults: {
    VCard: {
      elevation: 0,
      variant: 'flat',
      class: 'rounded-lg',
      style: 'border: 1px solid #E5E7EB',
    },
    VBtn: {
      rounded: 'lg',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
    },
    VTextarea: {
      variant: 'outlined',
      rounded: 'lg',
    },
  },
});

const pinia = createPinia();

const app = createApp(App);
app.use(pinia);
app.use(router);
app.use(vuetify);
app.mount('#app');
