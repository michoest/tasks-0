<template>
  <v-main class="bg-background">
    <v-container fluid class="pa-4">
      <v-row v-if="loading">
        <v-col cols="12" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
        </v-col>
      </v-row>

      <template v-else>
        <!-- Space Filter with Filter Button -->
        <div class="mb-4">
          <div class="d-flex align-center flex-wrap ga-2">
            <v-chip v-for="space in spacesStore.spaces" :key="space.id"
              :variant="selectedSpaceIds.includes(space.id) ? 'flat' : 'outlined'"
              :color="selectedSpaceIds.includes(space.id) ? (space.personal_color || 'primary') : ''"
              @click="toggleSpaceFilter(space.id)"
              size="small">
              <v-icon icon="mdi-folder" size="small" class="mr-1" />
              {{ space.personal_name || space.name }}
            </v-chip>
            <v-spacer />
            <v-badge
              :model-value="hasActiveFilters"
              dot
              color="primary"
              offset-x="-2"
              offset-y="-2"
            >
              <v-btn
                icon="mdi-filter-variant"
                size="small"
                variant="text"
                @click="filterDialog = true"
              />
            </v-badge>
          </div>
        </div>
        <!-- Overdue Tasks -->
        <div v-if="overdueTasks.length > 0" class="mb-6">
          <div class="d-flex align-center mb-3">
            <v-icon icon="mdi-alert-circle" color="error" class="mr-2" />
            <h2 class="text-h6 font-weight-bold text-error">Überfällig</h2>
            <v-chip size="small" color="error" class="ml-2">{{ overdueTasks.length }}</v-chip>
          </div>
          <v-card elevation="0">
            <v-list class="pa-0" lines="two">
              <v-list-item v-for="(task, index) in overdueTasks" :key="`${task.space_id}-${task.id}`"
                @click="openTaskSheet(task)" class="px-4 py-3" :style="{
                  backgroundColor: getOverdueColor(task.days_overdue),
                  color: getOverdueTextColor(task.days_overdue)
                }">
                <template #prepend>
                  <v-checkbox :model-value="task.completing || false" @click.stop="completeTask(task)" hide-details
                    color="success" density="compact" class="mr-4" />
                </template>

                <div class="d-flex align-center flex-wrap ga-2 mb-1">
                  <span v-if="spacesStore.spaces.length > 1" class="d-inline-flex align-center text-caption">
                    <v-icon icon="mdi-folder" size="small" class="mr-1" :color="task.space_color || 'grey'" />
                    {{ task.space_name }}
                  </span>
                  <span v-if="task.category" class="d-inline-flex align-center text-caption">
                    <v-icon :icon="task.category.icon || 'mdi-tag'" :color="task.category.color" size="small"
                      class="mr-1" />
                    {{ task.category.name }}
                  </span>
                </div>

                <v-list-item-title class="text-body-1 font-weight-medium">
                  {{ task.title }}
                </v-list-item-title>

                <v-list-item-subtitle class="d-flex align-center flex-wrap ga-2 mt-1">
                  <span class="text-error text-caption">{{ task.days_overdue }}d überfällig</span>
                  <span v-if="task.has_specific_time" class="d-inline-flex align-center text-caption">
                    <v-icon icon="mdi-clock-outline" size="small" class="mr-1" />
                    {{ task.time_of_day }}
                  </span>
                  <span class="d-inline-flex align-center text-caption">
                    <v-icon icon="mdi-refresh" size="small" class="mr-1" />
                    {{ getRecurrenceText(task) }}
                  </span>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>
        </div>

        <!-- Today's Tasks - Always Shown -->
        <div class="mb-6">
          <div class="d-flex align-center mb-3">
            <v-icon icon="mdi-calendar-today" color="warning" class="mr-2" />
            <h2 class="text-h6 font-weight-bold">Heute</h2>
            <v-chip size="small" color="warning" class="ml-2">{{ todayTasks.length }}</v-chip>
          </div>

          <v-card elevation="0" v-if="todayTasks.length > 0">
            <v-list class="pa-0" lines="two">
              <v-list-item v-for="(task, index) in todayTasks" :key="`${task.space_id}-${task.id}`"
                @click="openTaskSheet(task)" class="px-4 py-3">
                <template #prepend>
                  <v-checkbox :model-value="task.completing || false" @click.stop="completeTask(task)" hide-details
                    color="success" density="compact" class="mr-4" />
                </template>

                <div class="d-flex align-center flex-wrap ga-2 mb-1">
                  <span v-if="spacesStore.spaces.length > 1" class="d-inline-flex align-center text-caption">
                    <v-icon icon="mdi-folder" size="small" class="mr-1" :color="task.space_color || 'grey'" />
                    {{ task.space_name }}
                  </span>
                  <span v-if="task.category" class="d-inline-flex align-center text-caption">
                    <v-icon :icon="task.category.icon || 'mdi-tag'" :color="task.category.color" size="small"
                      class="mr-1" />
                    {{ task.category.name }}
                  </span>
                </div>

                <v-list-item-title class="text-body-1 font-weight-medium">
                  {{ task.title }}
                </v-list-item-title>

                <v-list-item-subtitle class="d-flex align-center flex-wrap ga-2 mt-1">
                  <span v-if="task.has_specific_time" class="d-inline-flex align-center text-caption">
                    <v-icon icon="mdi-clock-outline" size="small" class="mr-1" />
                    {{ task.time_of_day }}
                  </span>
                  <span class="d-inline-flex align-center text-caption">
                    <v-icon icon="mdi-refresh" size="small" class="mr-1" />
                    {{ getRecurrenceText(task) }}
                  </span>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- Empty Today State -->
          <v-card elevation="0" v-else>
            <v-card-text class="text-center py-8">
              <v-icon size="48" color="grey-lighten-1">mdi-check-circle-outline</v-icon>
              <div class="text-body-2 text-medium-emphasis mt-2">
                Keine Aufgaben für heute
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- Upcoming Tasks -->
        <div v-if="upcomingTasks.length > 0" class="mb-6">
          <div class="d-flex align-center mb-3 cursor-pointer" @click="upcomingExpanded = !upcomingExpanded">
            <v-icon icon="mdi-calendar-clock" class="mr-2" />
            <h2 class="text-h6 font-weight-bold">Demnächst</h2>
            <v-chip size="small" variant="outlined" class="ml-2">{{ upcomingTasks.length }}</v-chip>
            <v-spacer />
            <v-icon :icon="upcomingExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
          </div>
          <v-expand-transition>
          <v-card v-show="upcomingExpanded" elevation="0">
            <v-list class="pa-0" lines="two">
              <!-- Tomorrow -->
              <template v-if="tomorrowTasks.length > 0">
                <v-list-subheader class="px-4">
                  Morgen
                  <v-chip size="x-small" class="ml-2">{{ tomorrowTasks.length }}</v-chip>
                </v-list-subheader>

                <v-list-item v-for="task in tomorrowTasks" :key="`${task.space_id}-${task.id}`"
                  @click="openTaskSheet(task)" class="px-4 py-3">
                  <template #prepend>
                    <v-checkbox :model-value="false" @click.stop="completeTask(task)" hide-details color="success"
                      density="compact" class="mr-4" />
                  </template>

                  <div class="d-flex align-center flex-wrap ga-2 mb-1">
                    <span v-if="spacesStore.spaces.length > 1" class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-folder" size="small" class="mr-1" :color="task.space_color || 'grey'" />
                      {{ task.space_name }}
                    </span>
                    <span v-if="task.category" class="d-inline-flex align-center text-caption">
                      <v-icon :icon="task.category.icon || 'mdi-tag'" :color="task.category.color" size="small"
                        class="mr-1" />
                      {{ task.category.name }}
                    </span>
                  </div>

                  <v-list-item-title class="text-body-1 font-weight-medium">
                    {{ task.title }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="d-flex align-center flex-wrap ga-2 mt-1">
                    <span class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-calendar" size="small" class="mr-1" />
                      {{ formatDueDate(task) }}
                    </span>
                    <span v-if="task.has_specific_time" class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-clock-outline" size="small" class="mr-1" />
                      {{ task.time_of_day }}
                    </span>
                    <span class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-refresh" size="small" class="mr-1" />
                      {{ getRecurrenceText(task) }}
                    </span>
                  </v-list-item-subtitle>
                </v-list-item>
              </template>

              <!-- Next 7 Days -->
              <template v-if="next7DaysTasks.length > 0">
                <v-list-subheader class="px-4">
                  Nächste 7 Tage
                  <v-chip size="x-small" class="ml-2">{{ next7DaysTasks.length }}</v-chip>
                </v-list-subheader>

                <v-list-item v-for="task in next7DaysTasks" :key="`${task.space_id}-${task.id}`"
                  @click="openTaskSheet(task)" class="px-4 py-3">
                  <template #prepend>
                    <v-checkbox :model-value="false" @click.stop="completeTask(task)" hide-details color="success"
                      density="compact" class="mr-4" />
                  </template>

                  <div class="d-flex align-center flex-wrap ga-2 mb-1">
                    <span v-if="spacesStore.spaces.length > 1" class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-folder" size="small" class="mr-1" :color="task.space_color || 'grey'" />
                      {{ task.space_name }}
                    </span>
                    <span v-if="task.category" class="d-inline-flex align-center text-caption">
                      <v-icon :icon="task.category.icon || 'mdi-tag'" :color="task.category.color" size="small"
                        class="mr-1" />
                      {{ task.category.name }}
                    </span>
                  </div>

                  <v-list-item-title class="text-body-1 font-weight-medium">
                    {{ task.title }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="d-flex align-center flex-wrap ga-2 mt-1">
                    <span class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-calendar" size="small" class="mr-1" />
                      {{ formatDueDate(task) }}
                    </span>
                    <span v-if="task.has_specific_time" class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-clock-outline" size="small" class="mr-1" />
                      {{ task.time_of_day }}
                    </span>
                    <span class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-refresh" size="small" class="mr-1" />
                      {{ getRecurrenceText(task) }}
                    </span>
                  </v-list-item-subtitle>
                </v-list-item>
              </template>

              <!-- Later -->
              <template v-if="laterTasks.length > 0">
                <v-list-subheader class="px-4">
                  Später
                  <v-chip size="x-small" class="ml-2">{{ laterTasks.length }}</v-chip>
                </v-list-subheader>

                <v-list-item v-for="task in laterTasks" :key="`${task.space_id}-${task.id}`"
                  @click="openTaskSheet(task)" class="px-4 py-3">
                  <template #prepend>
                    <v-checkbox :model-value="false" @click.stop="completeTask(task)" hide-details color="success"
                      density="compact" class="mr-4" />
                  </template>

                  <div class="d-flex align-center flex-wrap ga-2 mb-1">
                    <span v-if="spacesStore.spaces.length > 1" class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-folder" size="small" class="mr-1" :color="task.space_color || 'grey'" />
                      {{ task.space_name }}
                    </span>
                    <span v-if="task.category" class="d-inline-flex align-center text-caption">
                      <v-icon :icon="task.category.icon || 'mdi-tag'" :color="task.category.color" size="small"
                        class="mr-1" />
                      {{ task.category.name }}
                    </span>
                  </div>

                  <v-list-item-title class="text-body-1 font-weight-medium">
                    {{ task.title }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="d-flex align-center flex-wrap ga-2 mt-1">
                    <span class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-calendar" size="small" class="mr-1" />
                      {{ formatDueDate(task) }}
                    </span>
                    <span v-if="task.has_specific_time" class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-clock-outline" size="small" class="mr-1" />
                      {{ task.time_of_day }}
                    </span>
                    <span class="d-inline-flex align-center text-caption">
                      <v-icon icon="mdi-refresh" size="small" class="mr-1" />
                      {{ getRecurrenceText(task) }}
                    </span>
                  </v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-list>
          </v-card>
          </v-expand-transition>
        </div>

        <!-- Inactive Tasks -->
        <div v-if="inactiveTasks.length > 0" class="mb-6">
          <div class="d-flex align-center mb-3 cursor-pointer" @click="inactiveExpanded = !inactiveExpanded">
            <v-icon icon="mdi-pause-circle-outline" class="mr-2" />
            <h2 class="text-h6 font-weight-bold">Inaktiv</h2>
            <v-chip size="small" variant="outlined" class="ml-2">{{ inactiveTasks.length }}</v-chip>
            <v-spacer />
            <v-icon :icon="inactiveExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
          </div>
          <v-expand-transition>
          <v-card v-show="inactiveExpanded" elevation="0">
            <v-list class="pa-0" lines="two">
              <v-list-item v-for="task in inactiveTasks" :key="`${task.space_id}-${task.id}`"
                @click="openTaskSheet(task)" class="px-4 py-3">
                <div class="d-flex align-center flex-wrap ga-2 mb-1">
                  <span v-if="spacesStore.spaces.length > 1" class="d-inline-flex align-center text-caption">
                    <v-icon icon="mdi-folder" size="small" class="mr-1" :color="task.space_color || 'grey'" />
                    {{ task.space_name }}
                  </span>
                  <span v-if="task.category" class="d-inline-flex align-center text-caption">
                    <v-icon :icon="task.category.icon || 'mdi-tag'" :color="task.category.color" size="small"
                      class="mr-1" />
                    {{ task.category.name }}
                  </span>
                </div>

                <v-list-item-title class="text-body-1 font-weight-medium">
                  {{ task.title }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
          </v-expand-transition>
        </div>

        <!-- Bottom padding to prevent FAB overlap -->
        <div style="height: 32px;"></div>
      </template>

      <!-- Add Task FAB -->
      <v-btn icon="mdi-plus" color="primary" size="large" position="fixed" location="bottom end" class="mb-16 me-4"
        @click="openCreateTask" />
    </v-container>

    <!-- Task Action Sheet -->
    <v-bottom-sheet v-model="taskSheet" scrollable>
      <v-card v-if="selectedTask">
        <v-card-title class="d-flex align-center pa-4">
          <v-icon v-if="selectedTask.category" :color="selectedTask.category.color" :icon="selectedTask.category.icon"
            class="mr-2" />
          <span class="text-h6 flex-grow-1">{{ selectedTask.title }}</span>
          <v-btn icon="mdi-close" variant="text" @click="taskSheet = false" />
        </v-card-title>

        <!-- Task Details -->
        <v-card-text class="px-4 pb-2">
          <div class="d-flex flex-wrap ga-2 mb-3">
            <v-chip v-if="spacesStore.spaces.length > 1" size="small" variant="outlined">
              <v-icon icon="mdi-folder" size="small" class="mr-1" :color="selectedTask.space_color || 'grey'" />
              {{ selectedTask.space_name }}
            </v-chip>
            <v-chip v-if="selectedTask.category" size="small" variant="outlined" :color="selectedTask.category.color">
              <v-icon :icon="selectedTask.category.icon" size="small" class="mr-1" />
              {{ selectedTask.category.name }}
            </v-chip>
            <v-chip size="small" variant="outlined">
              <v-icon icon="mdi-refresh" size="small" class="mr-1" />
              {{ getRecurrenceText(selectedTask) }}
            </v-chip>
            <v-chip v-if="selectedTask.has_specific_time" size="small" variant="outlined">
              <v-icon icon="mdi-clock-outline" size="small" class="mr-1" />
              {{ selectedTask.time_of_day }}
            </v-chip>
          </div>

          <p v-if="selectedTask.description" class="text-body-2 text-medium-emphasis">
            {{ selectedTask.description }}
          </p>
        </v-card-text>

        <v-divider />

        <!-- <v-list density="comfortable">
          <v-list-item @click="completeTaskAndClose">
            <template #prepend>
              <v-icon icon="mdi-check-circle" color="success" />
            </template>
            <v-list-item-title class="font-weight-medium">Erledigen</v-list-item-title>
          </v-list-item>

          <v-list-item v-if="selectedTask.recurrence_type !== 'no_date'" @click="skipTaskAndClose">
            <template #prepend>
              <v-icon icon="mdi-skip-next" />
            </template>
            <v-list-item-title>Überspringen</v-list-item-title>
          </v-list-item>

          <v-list-item @click="viewOccurrenceGraph">
            <template #prepend>
              <v-icon icon="mdi-chart-timeline-variant" />
            </template>
            <v-list-item-title>Verlauf anzeigen</v-list-item-title>
          </v-list-item>

          <v-list-item @click="editTask">
            <template #prepend>
              <v-icon icon="mdi-pencil" />
            </template>
            <v-list-item-title>Bearbeiten</v-list-item-title>
          </v-list-item>

          <v-divider />

          <v-list-item @click="deleteTask">
            <template #prepend>
              <v-icon icon="mdi-delete" color="error" />
            </template>
            <v-list-item-title class="text-error">Löschen</v-list-item-title>
          </v-list-item>
        </v-list> -->

        <v-card-actions>
          <v-spacer />
          <v-tooltip text="Als erledigt markieren" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-check" color="success" @click="completeTaskAndClose"></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip v-if="canSkipTask(selectedTask)" text="Überspringen" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-debug-step-over" @click="skipTaskAndClose"></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip v-if="canPostponeTask(selectedTask)" text="Verschieben" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-skip-next" @click="openPostponeSheet"></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="Statistik" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-chart-timeline-variant" @click="viewOccurrenceGraph"></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="Bearbeiten" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-pencil" @click="editTask"></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="Archivieren" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-delete" color="error" @click="deleteTask"></v-btn>
            </template>
          </v-tooltip>
          <v-spacer />
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Postpone Bottom Sheet -->
    <v-bottom-sheet v-model="postponeSheet">
      <v-card v-if="selectedTask">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-calendar-clock" class="mr-2" />
          <span>Verschieben</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="postponeSheet = false" />
        </v-card-title>

        <v-card-text>
          <div class="text-body-2 text-medium-emphasis mb-3">
            Aktuell fällig: {{ formatPostponeDate(selectedTask.next_due_date) }}
          </div>

          <!-- Quick options -->
          <div class="d-flex flex-wrap ga-2 mb-4">
            <v-chip @click="postponeByDays(1)" variant="outlined">+1 Tag</v-chip>
            <v-chip @click="postponeByDays(2)" variant="outlined">+2 Tage</v-chip>
            <v-chip @click="postponeByDays(3)" variant="outlined">+3 Tage</v-chip>
            <v-chip @click="postponeToTomorrow" variant="outlined">Morgen</v-chip>
            <v-chip @click="postponeToNextWeek" variant="outlined">Nächste Woche</v-chip>
          </div>

          <!-- Custom date picker -->
          <v-text-field
            v-model="postponeCustomDate"
            label="Anderes Datum"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-card-text>

        <v-card-actions>
          <v-btn variant="text" @click="postponeSheet = false">Abbrechen</v-btn>
          <v-spacer />
          <v-btn
            variant="text"
            color="primary"
            :disabled="!postponeCustomDate"
            @click="postponeToCustomDate"
          >
            Verschieben
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Task Edit Dialog -->
    <TaskDialogNew v-model="editDialog" :task="selectedTask" :categories="allCategories" :spaces="spacesStore.spaces"
      :default-space-id="selectedTask?.space_id" :space-members="[]" @save="saveTask" />

    <!-- Task Create Dialog -->
    <TaskDialogNew v-model="createDialog" :categories="allCategories" :spaces="spacesStore.spaces"
      :default-space-id="defaultSpaceId" :space-members="[]" @save="createTask" />

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :timeout="snackbarTimeout" :color="snackbarColor" location="top">
      {{ snackbarMessage }}
      <template #actions v-if="snackbarUndo">
        <v-btn icon="mdi-undo" variant="text" @click="undoLastAction" />
      </template>
    </v-snackbar>

    <!-- Filter Dialog -->
    <v-dialog v-model="filterDialog" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-filter-variant" class="mr-2" />
          Filter
        </v-card-title>
        <v-card-text>
          <div v-for="space in spacesStore.spaces" :key="space.id" class="mb-4">
            <div class="d-flex align-center">
              <v-switch
                :model-value="selectedSpaceIds.includes(space.id)"
                @update:model-value="toggleSpaceFilter(space.id)"
                :label="space.personal_name || space.name"
                :color="space.personal_color || 'primary'"
                hide-details
                density="compact"
              />
            </div>
            <v-expand-transition>
              <div v-if="selectedSpaceIds.includes(space.id)" class="ml-8 mt-2">
                <div
                  v-for="category in getCategoriesForSpace(space.id)"
                  :key="category.id"
                  class="d-flex align-center"
                >
                  <v-checkbox
                    :model-value="selectedCategoryIds.includes(category.id)"
                    @update:model-value="toggleCategoryFilter(category.id)"
                    :color="category.color"
                    hide-details
                    density="compact"
                  >
                    <template #label>
                      <v-icon :icon="category.icon || 'mdi-tag'" :color="category.color" size="small" class="mr-2" />
                      {{ category.name }}
                    </template>
                  </v-checkbox>
                </div>
                <div v-if="getCategoriesForSpace(space.id).length === 0" class="text-caption text-medium-emphasis">
                  Keine Kategorien
                </div>
              </div>
            </v-expand-transition>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="resetFilters">Zurücksetzen</v-btn>
          <v-spacer />
          <v-btn variant="text" color="primary" @click="filterDialog = false">Fertig</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSpacesStore } from '../stores/spaces.js';
import { api } from '../composables/useApi.js';
import { useEventBus } from '../composables/useEventBus.js';
import TaskDialogNew from '../components/TaskDialogNew.vue';

const router = useRouter();
const spacesStore = useSpacesStore();
const eventBus = useEventBus();

const loading = ref(false);
const allTasks = ref([]);
const allCategories = ref([]);
const taskSheet = ref(false);
const editDialog = ref(false);
const createDialog = ref(false);
const filterDialog = ref(false);
const postponeSheet = ref(false);
const postponeCustomDate = ref('');
const selectedTask = ref(null);
const isOnline = ref(navigator.onLine);
const upcomingExpanded = ref(false);
const inactiveExpanded = ref(false);

const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');
const snackbarTimeout = ref(2000);
const snackbarUndo = ref(false);
const lastCreatedTask = ref(null);

// Monitor online/offline status
window.addEventListener('online', () => {
  isOnline.value = true;
});
window.addEventListener('offline', () => {
  isOnline.value = false;
});

// Space filter - load from localStorage or default to all spaces
const selectedSpaceIds = ref([]);

// Category filter
const selectedCategoryIds = ref([]);

// Load filter from localStorage
function loadSpaceFilter() {
  const saved = localStorage.getItem('dashboard-space-filter');
  if (saved) {
    try {
      selectedSpaceIds.value = JSON.parse(saved);
    } catch (e) {
      selectedSpaceIds.value = [];
    }
  } else {
    // Default to all spaces
    selectedSpaceIds.value = spacesStore.spaces.map(s => s.id);
  }
}

// Save filter to localStorage
function saveSpaceFilter() {
  localStorage.setItem('dashboard-space-filter', JSON.stringify(selectedSpaceIds.value));
}

// Toggle space filter
function toggleSpaceFilter(spaceId) {
  const index = selectedSpaceIds.value.indexOf(spaceId);
  if (index === -1) {
    selectedSpaceIds.value.push(spaceId);
  } else {
    selectedSpaceIds.value.splice(index, 1);
  }
  saveSpaceFilter();
}

// Watch for changes to persist
watch(selectedSpaceIds, saveSpaceFilter, { deep: true });

// Load category filter from localStorage
function loadCategoryFilter() {
  const saved = localStorage.getItem('dashboard-category-filter');
  if (saved) {
    try {
      selectedCategoryIds.value = JSON.parse(saved);
    } catch (e) {
      selectedCategoryIds.value = [];
    }
  } else {
    // Default to all categories
    selectedCategoryIds.value = allCategories.value.map(c => c.id);
  }
}

// Save category filter to localStorage
function saveCategoryFilter() {
  localStorage.setItem('dashboard-category-filter', JSON.stringify(selectedCategoryIds.value));
}

// Toggle category filter
function toggleCategoryFilter(categoryId) {
  const index = selectedCategoryIds.value.indexOf(categoryId);
  if (index === -1) {
    selectedCategoryIds.value.push(categoryId);
  } else {
    selectedCategoryIds.value.splice(index, 1);
  }
  saveCategoryFilter();
}

// Watch for changes to persist
watch(selectedCategoryIds, saveCategoryFilter, { deep: true });

// Available categories based on selected spaces
const availableCategories = computed(() => {
  if (selectedSpaceIds.value.length === 0) {
    return allCategories.value;
  }
  return allCategories.value.filter(c => selectedSpaceIds.value.includes(c.space_id));
});

// Get categories for a specific space
function getCategoriesForSpace(spaceId) {
  return allCategories.value.filter(c => c.space_id === spaceId);
}

// Check if there are active filters (not all spaces/categories selected)
const hasActiveFilters = computed(() => {
  const allSpacesSelected = selectedSpaceIds.value.length === spacesStore.spaces.length;
  const allCategoriesSelected = selectedCategoryIds.value.length === allCategories.value.length;
  return !allSpacesSelected || !allCategoriesSelected;
});

// Reset all filters to default (all selected)
function resetFilters() {
  selectedSpaceIds.value = spacesStore.spaces.map(s => s.id);
  selectedCategoryIds.value = allCategories.value.map(c => c.id);
  saveSpaceFilter();
  saveCategoryFilter();
}

// Filtered tasks based on selected spaces and categories (excludes inactive)
const filteredTasks = computed(() => {
  let tasks = allTasks.value.filter(t => t.recurrence_type !== 'inactive');

  // Filter by space
  if (selectedSpaceIds.value.length > 0) {
    tasks = tasks.filter(t => selectedSpaceIds.value.includes(t.space_id));
  }

  // Filter by category
  if (selectedCategoryIds.value.length > 0) {
    tasks = tasks.filter(t => !t.category_id || selectedCategoryIds.value.includes(t.category_id));
  }

  return tasks;
});

// Inactive tasks (filtered by space and category)
const inactiveTasks = computed(() => {
  let tasks = allTasks.value.filter(t => t.recurrence_type === 'inactive');

  // Filter by space
  if (selectedSpaceIds.value.length > 0) {
    tasks = tasks.filter(t => selectedSpaceIds.value.includes(t.space_id));
  }

  // Filter by category
  if (selectedCategoryIds.value.length > 0) {
    tasks = tasks.filter(t => !t.category_id || selectedCategoryIds.value.includes(t.category_id));
  }

  return tasks;
});

// Helper: Sort tasks chronologically (full-day before time-specific, then by time)
function sortTasksChronologically(tasks) {
  return tasks.sort((a, b) => {
    // Full-day tasks (no specific time) come first
    if (!a.has_specific_time && b.has_specific_time) return -1;
    if (a.has_specific_time && !b.has_specific_time) return 1;

    // If both have specific times, sort by time
    if (a.has_specific_time && b.has_specific_time) {
      return a.time_of_day.localeCompare(b.time_of_day);
    }

    // If both are full-day, maintain order
    return 0;
  });
}

// Filter time-specific tasks for today
const timeSpecificTasksToday = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  return filteredTasks.value
    .filter(t => t.has_specific_time && t.next_due_date === today)
    .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));
});

// Group tasks by status (excluding time-specific tasks already shown in calendar)
const overdueTasks = computed(() => {
  const tasks = filteredTasks.value.filter(t => t.is_overdue && !isInTimeSpecificToday(t));
  return sortTasksChronologically(tasks);
});

const todayTasks = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  const tasks = filteredTasks.value.filter(t => {
    // Include tasks with no date (recurrence_type === 'no_date')
    if (t.recurrence_type === 'no_date' && !t.is_overdue) return true;
    // Include tasks due today
    return !t.is_overdue && t.next_due_date === today && !isInTimeSpecificToday(t);
  });
  return sortTasksChronologically(tasks);
});

// Upcoming tasks grouped by time buckets
const tomorrowTasks = computed(() => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const tasks = filteredTasks.value.filter(t => t.next_due_date === tomorrowStr);
  return sortTasksChronologically(tasks);
});

const next7DaysTasks = computed(() => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next7Days = new Date(today);
  next7Days.setDate(next7Days.getDate() + 7);

  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const next7DaysStr = next7Days.toISOString().split('T')[0];

  const tasks = filteredTasks.value.filter(t =>
    t.next_due_date > tomorrowStr && t.next_due_date <= next7DaysStr
  );
  return sortTasksChronologically(tasks);
});

const laterTasks = computed(() => {
  const today = new Date();
  const next7Days = new Date(today);
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysStr = next7Days.toISOString().split('T')[0];

  const tasks = filteredTasks.value.filter(t => t.next_due_date > next7DaysStr);
  return sortTasksChronologically(tasks);
});

const upcomingTasks = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  return filteredTasks.value.filter(t => t.next_due_date > today);
});

function isInTimeSpecificToday(task) {
  const today = new Date().toISOString().split('T')[0];
  return task.has_specific_time && task.next_due_date === today;
}

// Get color based on days overdue (light red for 1 day, dark red for 5+ days)
function getOverdueColor(daysOverdue) {
  if (daysOverdue <= 1) return '#FFCDD2'; // Light red
  if (daysOverdue <= 2) return '#EF9A9A'; //
  if (daysOverdue <= 3) return '#E57373'; //
  if (daysOverdue <= 5) return '#EF5350'; //
  return '#D32F2F'; // Dark red for 5+ days
}

function getOverdueTextColor(daysOverdue) {
  // Use dark text for light backgrounds, white text for dark backgrounds
  return daysOverdue <= 2 ? '#000000' : '#FFFFFF';
}

// Smart defaults: first ordered space
const defaultSpaceId = computed(() => {
  if (spacesStore.spaces.length === 0) return null;
  return spacesStore.spaces[0].id;
});

// Default categories: categories from default space
const defaultCategories = computed(() => {
  if (!defaultSpaceId.value) return [];
  return allCategories.value.filter(cat => cat.space_id === defaultSpaceId.value);
});

// Open create task dialog
function openCreateTask() {
  createDialog.value = true;
}

onMounted(async () => {
  await refreshAll();
  loadSpaceFilter();
  loadCategoryFilter();

  // Listen for dashboard refresh events from app bar
  eventBus.on('dashboard:refresh', refreshAll);
});

async function refreshAll() {
  loading.value = true;
  try {
    await spacesStore.fetchSpaces();

    const taskPromises = spacesStore.spaces.map(async (space) => {
      try {
        const res = await api.get(`/spaces/${space.id}/tasks`);
        return res.tasks.map(task => ({
          ...task,
          space_id: space.id,
          space_name: space.personal_name || space.name,
          space_color: space.personal_color
        }));
      } catch (error) {
        console.error(`Failed to fetch tasks for space ${space.id}:`, error);
        return [];
      }
    });

    const categoriesPromises = spacesStore.spaces.map(async (space) => {
      try {
        const res = await api.get(`/spaces/${space.id}/categories`);
        return res.categories.map(cat => ({ ...cat, space_id: space.id }));
      } catch (error) {
        return [];
      }
    });

    const [tasksArrays, categoriesArrays] = await Promise.all([
      Promise.all(taskPromises),
      Promise.all(categoriesPromises)
    ]);

    allTasks.value = tasksArrays.flat();
    allCategories.value = categoriesArrays.flat();
  } finally {
    loading.value = false;
  }
}

function openTaskSheet(task) {
  selectedTask.value = task;
  taskSheet.value = true;
}

async function completeTask(task) {
  try {
    // Mark task as completing with visual feedback
    const taskIndex = allTasks.value.findIndex(t => t.space_id === task.space_id && t.id === task.id);
    if (taskIndex !== -1) {
      allTasks.value[taskIndex] = { ...allTasks.value[taskIndex], completing: true };
    }

    // Wait for half a second for visual feedback
    await new Promise(resolve => setTimeout(resolve, 500));

    const res = await api.post(`/spaces/${task.space_id}/tasks/${task.id}/complete`, {});

    // Remove task if it's one-time or no_date (no next occurrence)
    // Check if next_due_date is null which means no recurrence
    const shouldRemove = !res.next_due_date ||
      res.task?.recurrence_type === 'one_time' ||
      res.task?.recurrence_type === 'no_date';

    if (shouldRemove) {
      // Task is completed and won't recur, remove it
      allTasks.value = allTasks.value.filter(t => !(t.space_id === task.space_id && t.id === task.id));
    } else if (res.task && taskIndex !== -1) {
      // Task has next occurrence, update it
      allTasks.value[taskIndex] = { ...res.task, space_id: task.space_id, space_name: task.space_name, space_color: task.space_color };
    }

    snackbarMessage.value = `Erledigt: ${task.title}`;
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to complete task:', error);
    snackbarMessage.value = 'Fehler beim Erledigen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function completeTaskAndClose() {
  await completeTask(selectedTask.value);
  taskSheet.value = false;
}

async function skipTaskAndClose() {
  try {
    const res = await api.post(`/spaces/${selectedTask.value.space_id}/tasks/${selectedTask.value.id}/skip`, {});
    const index = allTasks.value.findIndex(t =>
      t.space_id === selectedTask.value.space_id && t.id === selectedTask.value.id
    );
    if (index !== -1) {
      allTasks.value[index] = { ...res.task, space_id: selectedTask.value.space_id, space_name: selectedTask.value.space_name, space_color: selectedTask.value.space_color };
    }
    taskSheet.value = false;
    snackbarMessage.value = 'Aufgabe übersprungen';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to skip task:', error);
    snackbarMessage.value = 'Fehler beim Überspringen';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

// Check if a task can be skipped (only recurring tasks)
function canSkipTask(task) {
  return task && ['interval', 'schedule'].includes(task.recurrence_type);
}

// Check if a task can be postponed (tasks with dates)
function canPostponeTask(task) {
  return task && ['one_time', 'interval', 'schedule'].includes(task.recurrence_type);
}

// Open postpone sheet
function openPostponeSheet() {
  postponeCustomDate.value = '';
  taskSheet.value = false;
  postponeSheet.value = true;
}

// Format date for postpone display
function formatPostponeDate(dateStr) {
  if (!dateStr) return 'Kein Datum';
  const date = new Date(dateStr);
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return `${dayNames[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

// Postpone by X days
async function postponeByDays(days) {
  await postponeTask({ days });
}

// Postpone to tomorrow
async function postponeToTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await postponeTask({ new_date: tomorrow.toISOString().split('T')[0] });
}

// Postpone to next week (same weekday)
async function postponeToNextWeek() {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  await postponeTask({ new_date: nextWeek.toISOString().split('T')[0] });
}

// Postpone to custom date
async function postponeToCustomDate() {
  if (!postponeCustomDate.value) return;
  await postponeTask({ new_date: postponeCustomDate.value });
}

// Core postpone function
async function postponeTask(params) {
  try {
    const res = await api.post(`/spaces/${selectedTask.value.space_id}/tasks/${selectedTask.value.id}/postpone`, params);
    const index = allTasks.value.findIndex(t =>
      t.space_id === selectedTask.value.space_id && t.id === selectedTask.value.id
    );
    if (index !== -1) {
      allTasks.value[index] = { ...res.task, space_id: selectedTask.value.space_id, space_name: selectedTask.value.space_name, space_color: selectedTask.value.space_color };
    }
    postponeSheet.value = false;
    snackbarMessage.value = `Verschoben auf ${formatPostponeDate(res.next_due_date)}`;
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to postpone task:', error);
    snackbarMessage.value = 'Fehler beim Verschieben';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

function editTask() {
  taskSheet.value = false;
  editDialog.value = true;
}

async function saveTask(data) {
  try {
    const originalSpaceId = selectedTask.value.space_id;
    const newSpaceId = data.space_id;

    // If space is changing, we need to delete from old space and create in new space
    if (newSpaceId && newSpaceId !== originalSpaceId) {
      // Create task in new space
      await api.post(`/spaces/${newSpaceId}/tasks`, data);
      // Delete from old space
      await api.delete(`/spaces/${originalSpaceId}/tasks/${selectedTask.value.id}`);
    } else {
      // Just update in same space
      await api.patch(`/spaces/${originalSpaceId}/tasks/${selectedTask.value.id}`, data);
    }

    await refreshAll();
    snackbarMessage.value = 'Aufgabe aktualisiert';
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to save task:', error);
    snackbarMessage.value = 'Fehler beim Speichern';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
}

async function createTask(data) {
  const spaceId = data.space_id || defaultSpaceId.value;
  if (!spaceId) {
    snackbarMessage.value = 'Kein Space verfügbar';
    snackbarColor.value = 'error';
    snackbarTimeout.value = 2000;
    snackbarUndo.value = false;
    showSnackbar.value = true;
    return;
  }

  try {
    const res = await api.post(`/spaces/${spaceId}/tasks`, data);
    await refreshAll();

    // Store created task for undo
    lastCreatedTask.value = { id: res.task.id, space_id: spaceId };

    snackbarMessage.value = `Erstellt: ${data.title}`;
    snackbarColor.value = 'success';
    snackbarTimeout.value = 4000;
    snackbarUndo.value = true;
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to create task:', error);
    snackbarMessage.value = 'Fehler beim Erstellen';
    snackbarColor.value = 'error';
    snackbarTimeout.value = 2000;
    snackbarUndo.value = false;
    showSnackbar.value = true;
  }
}

function formatDueDate(task) {
  if (!task.next_due_date) return '';
  const date = new Date(task.next_due_date);
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${dayNames[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}.`;
}

function getRecurrenceText(task) {
  if (task.recurrence_type === 'no_date') return 'Ohne Datum';
  if (task.recurrence_type === 'one_time') return 'Einmalig';
  if (task.recurrence_type === 'interval') {
    const days = task.interval_days || 1;
    return `Alle ${days} Tag${days > 1 ? 'e' : ''}`;
  }
  if (task.recurrence_type === 'schedule') {
    try {
      const pattern = JSON.parse(task.schedule_pattern);
      if (pattern.type === 'weekly') return 'Wöchentlich';
      if (pattern.type === 'monthly') return 'Monatlich';
    } catch (e) {
      return 'Zeitplan';
    }
  }
  return 'Wiederholend';
}

function viewOccurrenceGraph() {
  taskSheet.value = false;
  router.push('/history');
}

async function deleteTask() {
  if (!confirm(`Möchten Sie die Aufgabe "${selectedTask.value.title}" wirklich löschen?`)) {
    return;
  }

  try {
    await api.delete(`/spaces/${selectedTask.value.space_id}/tasks/${selectedTask.value.id}`);
    allTasks.value = allTasks.value.filter(t =>
      !(t.space_id === selectedTask.value.space_id && t.id === selectedTask.value.id)
    );
    taskSheet.value = false;
    snackbarMessage.value = 'Aufgabe gelöscht';
    snackbarColor.value = 'success';
    snackbarTimeout.value = 2000;
    snackbarUndo.value = false;
    showSnackbar.value = true;
  } catch (error) {
    console.error('Failed to delete task:', error);
    snackbarMessage.value = 'Fehler beim Löschen';
    snackbarColor.value = 'error';
    snackbarTimeout.value = 2000;
    snackbarUndo.value = false;
    showSnackbar.value = true;
  }
}

async function undoLastAction() {
  if (!lastCreatedTask.value) return;

  try {
    await api.delete(`/spaces/${lastCreatedTask.value.space_id}/tasks/${lastCreatedTask.value.id}`);
    await refreshAll();
    lastCreatedTask.value = null;
    showSnackbar.value = false;
  } catch (error) {
    console.error('Failed to undo:', error);
    snackbarMessage.value = 'Rückgängig fehlgeschlagen';
    snackbarColor.value = 'error';
    snackbarTimeout.value = 2000;
    snackbarUndo.value = false;
    showSnackbar.value = true;
  }
}
</script>

<style scoped>
.bg-background {
  background-color: #F9FAFB;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
