<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card>
          <v-card-title class="text-h5 text-center">
            Registrieren
          </v-card-title>

          <v-card-text>
            <v-form @submit.prevent="handleRegister">
              <v-text-field
                v-model="email"
                label="E-Mail"
                type="email"
                required
                autofocus
                :disabled="loading"
              />

              <v-text-field
                v-model="password"
                label="Passwort"
                type="password"
                required
                :disabled="loading"
              />

              <v-text-field
                v-model="passwordConfirm"
                label="Passwort bestätigen"
                type="password"
                required
                :disabled="loading"
              />

              <v-alert
                v-if="error"
                type="error"
                class="mb-4"
                closable
                @click:close="error = null"
              >
                {{ error }}
              </v-alert>

              <v-btn
                type="submit"
                color="primary"
                block
                :loading="loading"
              >
                Registrieren
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn
              :to="{ name: 'login' }"
              variant="text"
              :disabled="loading"
            >
              Bereits ein Konto? Anmelden
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const passwordConfirm = ref('');
const loading = ref(false);
const error = ref(null);

async function handleRegister() {
  loading.value = true;
  error.value = null;

  if (password.value !== passwordConfirm.value) {
    error.value = 'Passwörter stimmen nicht überein';
    loading.value = false;
    return;
  }

  try {
    await authStore.register(email.value, password.value);
    router.push('/');
  } catch (err) {
    error.value = err.message || 'Registrierung fehlgeschlagen';
  } finally {
    loading.value = false;
  }
}
</script>
