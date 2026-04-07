<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <button class="btn-secondary text-xs" @click="openDialog"><i class="pi pi-plus text-xs"></i> Nieuwe offerte</button>
    </div>
    <div v-for="prop in proposals" :key="prop.id" class="card p-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <span class="text-sm font-medium text-gray-800">{{ prop.title }}</span>
        <span :class="statusColor(prop.status)" class="badge text-[10px]">{{ prop.status }}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-mono text-sm font-medium text-gray-800">{{ formatCurrency(prop.amount) }}</span>
        <button class="btn-icon" @click="downloadPdf(prop)" title="PDF"><i class="pi pi-file-pdf text-xs"></i></button>
        <button class="btn-icon text-red-600" @click="deleteProposal(prop)" title="Verwijderen"><i class="pi pi-trash text-xs"></i></button>
      </div>
    </div>
    <p v-if="!proposals.length" class="text-center text-sm text-gray-400 py-8">Geen offertes voor dit project</p>

    <Dialog v-model:visible="showDialog" header="Nieuwe offerte" modal :style="{ width: '520px' }">
      <form @submit.prevent="createProposal" class="space-y-4">
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Titel</label><input v-model="form.title" class="input" required /></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Ontvanger naam</label><input v-model="form.recipient_name" class="input" required /></div>
          <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Ontvanger e-mail</label><input v-model="form.recipient_email" class="input" type="email" required /></div>
          <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Bedrag</label><InputNumber v-model="form.amount" mode="currency" currency="EUR" locale="nl-NL" class="w-full" /></div>
          <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Levertijd</label><input v-model="form.delivery_time" class="input" placeholder="Bijv. 4-6 weken" /></div>
        </div>
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Samenvatting</label><textarea v-model="form.summary" class="input min-h-[60px]" /></div>
        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <button type="button" class="btn-secondary" @click="showDialog = false">Annuleren</button>
          <button type="submit" class="btn-primary" :disabled="saving">Aanmaken</button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { proposalsApi } from '@/api/services'
import { useFormatting } from '@/composables/useFormatting'
import { useErrorHandler } from '@/composables/useErrorHandler'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'

interface Proposal { id: string; title: string; status: string; amount: number }
interface Client { company_name: string; contact_name: string; email: string }

const props = defineProps<{ projectId: string; clientId: string; client: Client | null }>()
const emit = defineEmits<{ (e: 'count-change', count: number): void }>()
const { formatCurrency, statusColor, downloadBlob } = useFormatting()
const { showError, showSuccess } = useErrorHandler()

const proposals = ref<Proposal[]>([])
const showDialog = ref(false)
const saving = ref(false)
const form = ref({
  title: '', recipient_name: '', recipient_email: '',
  recipient_company: '', amount: 0, delivery_time: '', summary: '', scope: '',
})

onMounted(async () => {
  const { data } = await proposalsApi.listByProject(props.projectId)
  proposals.value = data
  emit('count-change', data.length)
})

function openDialog() {
  form.value = {
    title: '',
    recipient_name: props.client?.contact_name || '',
    recipient_email: props.client?.email || '',
    recipient_company: props.client?.company_name || '',
    amount: 0,
    delivery_time: '',
    summary: '',
    scope: '',
  }
  showDialog.value = true
}

async function createProposal() {
  saving.value = true
  try {
    await proposalsApi.create({ client_id: props.clientId, project_id: props.projectId, ...form.value })
    showDialog.value = false
    const { data } = await proposalsApi.listByProject(props.projectId)
    proposals.value = data
    emit('count-change', data.length)
    showSuccess('Offerte aangemaakt')
  } catch (err) { showError(err) }
  saving.value = false
}

async function downloadPdf(prop: Proposal) {
  try {
    const { data } = await proposalsApi.downloadPdf(prop.id)
    downloadBlob(data, `offerte-${prop.title}.pdf`)
  } catch (err) { showError(err, 'PDF genereren mislukt') }
}

async function deleteProposal(prop: Proposal) {
  try {
    await proposalsApi.delete(prop.id)
    proposals.value = proposals.value.filter(p => p.id !== prop.id)
    emit('count-change', proposals.value.length)
    showSuccess('Offerte verwijderd')
  } catch (err) { showError(err) }
}
</script>
