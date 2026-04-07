<template>
  <div class="space-y-3">
    <div class="flex gap-2">
      <input v-model="newTaskTitle" placeholder="Nieuwe taak..." class="input flex-1" @keyup.enter="addTask" />
      <Calendar v-model="newTaskDeadline" dateFormat="dd-mm-yy" placeholder="Deadline" showClear class="w-40" />
      <button class="btn-primary" @click="addTask" :disabled="!newTaskTitle.trim()">Toevoegen</button>
    </div>
    <div v-for="task in tasks" :key="task.id" class="card p-4 flex items-center gap-3">
      <button class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
        :class="task.status === 'DONE' ? 'bg-green-500 border-green-500' : task.status === 'IN_PROGRESS' ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-green-400'"
        @click="toggleDone(task)">
        <i v-if="task.status === 'DONE'" class="pi pi-check text-white text-[10px]"></i>
        <div v-else-if="task.status === 'IN_PROGRESS'" class="w-2 h-2 rounded-full bg-blue-400"></div>
      </button>
      <div class="flex-1 min-w-0">
        <span class="text-sm text-gray-800" :class="task.status === 'DONE' ? 'line-through text-gray-400' : ''">{{ task.title }}</span>
        <p v-if="task.description" class="text-xs text-gray-400 mt-0.5">{{ task.description }}</p>
      </div>
      <span v-if="task.deadline" class="text-xs font-mono shrink-0"
        :class="new Date(task.deadline) < new Date(new Date().toDateString()) && task.status !== 'DONE' ? 'text-red-500 font-medium' : 'text-gray-400'">
        {{ formatDate(task.deadline) }}
      </span>
      <button class="btn-icon text-red-600" @click="deleteTask(task)"><i class="pi pi-trash text-xs"></i></button>
    </div>
    <p v-if="!tasks.length" class="text-center text-sm text-gray-400 py-8">Geen taken</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { tasksApi } from '@/api/services'
import { useFormatting } from '@/composables/useFormatting'
import { useErrorHandler } from '@/composables/useErrorHandler'
import Calendar from 'primevue/calendar'

interface Task { id: string; title: string; description: string | null; status: string; deadline: string | null }

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ (e: 'count-change', count: number): void }>()
const { formatDate, toISODate } = useFormatting()
const { showError } = useErrorHandler()

const tasks = ref<Task[]>([])
const newTaskTitle = ref('')
const newTaskDeadline = ref<Date | null>(null)

onMounted(async () => {
  const { data } = await tasksApi.list({ project_id: props.projectId })
  tasks.value = data
  emit('count-change', data.length)
})

async function addTask() {
  if (!newTaskTitle.value.trim()) return
  try {
    await tasksApi.create({
      title: newTaskTitle.value,
      project_id: props.projectId,
      deadline: newTaskDeadline.value ? toISODate(newTaskDeadline.value) : null,
    })
    newTaskTitle.value = ''
    newTaskDeadline.value = null
    const { data } = await tasksApi.list({ project_id: props.projectId })
    tasks.value = data
    emit('count-change', data.length)
  } catch (err) { showError(err) }
}

async function toggleDone(task: Task) {
  const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
  await tasksApi.update(task.id, { status: newStatus })
  const { data } = await tasksApi.list({ project_id: props.projectId })
  tasks.value = data
}

async function deleteTask(task: Task) {
  await tasksApi.delete(task.id)
  tasks.value = tasks.value.filter(t => t.id !== task.id)
  emit('count-change', tasks.value.length)
}
</script>
