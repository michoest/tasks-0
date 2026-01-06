<template>
  <v-main class="bg-background">
      <v-container fluid class="pa-4">
        <h1 class="text-h5 font-weight-bold mb-4">Verlauf & Statistiken</h1>

        <!-- Daily Completion Stats -->
        <v-card class="mb-4" elevation="0">
          <v-card-title class="text-h6">Erledigte Aufgaben</v-card-title>
          <v-card-text>
            <div class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1">mdi-chart-bar</v-icon>
              <p class="text-body-1 text-medium-emphasis mt-4">
                Täglich erledigte Aufgaben werden hier angezeigt
              </p>
            </div>
          </v-card-text>
        </v-card>

        <!-- Task Timeline -->
        <v-card elevation="0">
          <v-card-title class="text-h6">Aufgaben-Timeline</v-card-title>
          <v-card-text>
            <div class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1">mdi-timeline-clock</v-icon>
              <p class="text-body-1 text-medium-emphasis mt-4">
                Verlauf wiederholter Aufgaben wird hier angezeigt
              </p>
            </div>
          </v-card-text>
        </v-card>
      </v-container>
  </v-main>
</template>

<script setup>
import { ref } from 'vue';

// Placeholder for future implementation
const completionStats = ref([]);
const taskTimeline = ref([]);
</script>

<style scoped>
.bg-background {
  background-color: #F9FAFB;
}
</style>
