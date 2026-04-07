<template>
  <div class="space-y-3">
    <div class="flex gap-2">
      <input v-model="newNote" placeholder="Notitie toevoegen..." class="input flex-1" @keyup.enter="addNote" />
      <button class="btn-primary" @click="addNote" :disabled="!newNote.trim()">Toevoegen</button>
    </div>
    <div v-for="note in notes" :key="note.id" class="card p-4 flex justify-between items-start">
      <div>
        <p class="text-sm text-gray-700">{{ note.content }}</p>
        <p class="text-[11px] font-mono text-gray-400 mt-1">{{ formatDateTime(note.created_at) }}</p>
      </div>
      <button class="btn-icon text-red-600" @click="deleteNote(note.id)"><i class="pi pi-trash text-xs"></i></button>
    </div>
    <p v-if="!notes.length" class="text-center text-sm text-gray-400 py-8">Geen notities</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { notesApi } from '@/modules/projects/api'
import { useFormatting } from '@/composables/useFormatting'
import { useErrorHandler } from '@/composables/useErrorHandler'

interface Note { id: string; content: string; created_at: string }

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ (e: 'count-change', count: number): void }>()

const { formatDateTime } = useFormatting()
const { showError } = useErrorHandler()

const notes = ref<Note[]>([])
const newNote = ref('')

onMounted(async () => {
  const { data } = await notesApi.list(props.projectId)
  notes.value = data
  emit('count-change', data.length)
})

async function addNote() {
  if (!newNote.value.trim()) return
  try {
    await notesApi.create(props.projectId, { content: newNote.value })
    newNote.value = ''
    const { data } = await notesApi.list(props.projectId)
    notes.value = data
    emit('count-change', data.length)
  } catch (err) { showError(err) }
}

async function deleteNote(id: string) {
  try {
    await notesApi.delete(id)
    notes.value = notes.value.filter(n => n.id !== id)
    emit('count-change', notes.value.length)
  } catch (err) { showError(err) }
}
</script>
