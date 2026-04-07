<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <button class="btn-secondary text-xs" @click="showDialog = true"><i class="pi pi-plus text-xs"></i> Toevoegen</button>
    </div>
    <div v-for="entry in communications" :key="entry.id" class="card p-4">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span :class="statusColor(entry.type)" class="badge text-[10px]">{{ entry.type }}</span>
            <span class="text-sm font-medium text-gray-800">{{ entry.subject }}</span>
          </div>
          <p class="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{{ entry.content }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0 ml-4">
          <span class="text-[11px] font-mono text-gray-400">{{ formatDateTime(entry.occurred_at) }}</span>
          <button class="btn-icon text-red-600" @click="deleteEntry(entry.id)"><i class="pi pi-trash text-xs"></i></button>
        </div>
      </div>
    </div>
    <p v-if="!communications.length" class="text-center text-sm text-gray-400 py-8">Geen communicatie</p>

    <Dialog v-model:visible="showDialog" header="Communicatie toevoegen" modal :style="{ width: '520px' }">
      <form @submit.prevent="addEntry" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Type</label><Dropdown v-model="form.type" :options="commTypes" optionLabel="label" optionValue="value" class="w-full" /></div>
          <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Datum</label><Calendar v-model="form.occurred_at" showTime dateFormat="dd-mm-yy" class="w-full" /></div>
          <div class="col-span-2"><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Onderwerp</label><input v-model="form.subject" class="input" required /></div>
          <div class="col-span-2"><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Inhoud</label><textarea v-model="form.content" class="input min-h-[100px]" required /></div>
        </div>
        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <button type="button" class="btn-secondary" @click="showDialog = false">Annuleren</button>
          <button type="submit" class="btn-primary" :disabled="saving">Opslaan</button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { communicationApi } from '@/modules/projects/api'
import { useFormatting } from '@/composables/useFormatting'
import { useErrorHandler } from '@/composables/useErrorHandler'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Calendar from 'primevue/calendar'

interface Communication { id: string; type: string; subject: string; content: string; occurred_at: string }

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ (e: 'count-change', count: number): void }>()
const { formatDateTime, statusColor } = useFormatting()
const { showError, showSuccess } = useErrorHandler()

const communications = ref<Communication[]>([])
const showDialog = ref(false)
const saving = ref(false)
const form = ref({ type: 'EMAIL', subject: '', content: '', occurred_at: new Date() })

const commTypes = [
  { label: 'E-mail', value: 'EMAIL' }, { label: 'Telefoon', value: 'CALL' },
  { label: 'Meeting', value: 'MEETING' }, { label: 'WhatsApp', value: 'WHATSAPP' },
  { label: 'DM', value: 'DM' }, { label: 'Intern', value: 'INTERNAL' }, { label: 'Overig', value: 'OTHER' },
]

onMounted(async () => {
  const { data } = await communicationApi.list(props.projectId)
  communications.value = data
  emit('count-change', data.length)
})

async function addEntry() {
  saving.value = true
  try {
    await communicationApi.create(props.projectId, {
      ...form.value,
      occurred_at: form.value.occurred_at.toISOString(),
    })
    showDialog.value = false
    form.value = { type: 'EMAIL', subject: '', content: '', occurred_at: new Date() }
    const { data } = await communicationApi.list(props.projectId)
    communications.value = data
    emit('count-change', data.length)
    showSuccess('Toegevoegd')
  } catch (err) { showError(err) }
  saving.value = false
}

async function deleteEntry(id: string) {
  try {
    await communicationApi.delete(id)
    communications.value = communications.value.filter(c => c.id !== id)
    emit('count-change', communications.value.length)
  } catch (err) { showError(err) }
}
</script>
