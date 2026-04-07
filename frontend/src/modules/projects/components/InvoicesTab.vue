<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <button class="btn-secondary text-xs" @click="openDialog"><i class="pi pi-plus text-xs"></i> Nieuwe factuur</button>
    </div>
    <div v-for="inv in invoices" :key="inv.id" class="card p-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <span class="font-mono text-xs text-gray-700">{{ inv.invoice_number }}</span>
        <span class="text-xs text-gray-500">{{ formatDate(inv.issue_date) }}</span>
        <span :class="statusColor(inv.status)" class="badge text-[10px]">{{ inv.status }}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-mono text-sm font-medium text-gray-800">{{ formatCurrency(Number(inv.total_amount)) }}</span>
        <button class="btn-icon" @click="downloadPdf(inv)" title="PDF"><i class="pi pi-file-pdf text-xs"></i></button>
        <button v-if="inv.status !== 'PAID'" class="btn-icon text-green-600" @click="markPaid(inv)" title="Betaald markeren"><i class="pi pi-check text-xs"></i></button>
        <button class="btn-icon text-red-600" @click="deleteInvoice(inv)" title="Verwijderen"><i class="pi pi-trash text-xs"></i></button>
      </div>
    </div>
    <p v-if="!invoices.length" class="text-center text-sm text-gray-400 py-8">Geen facturen voor dit project</p>

    <Dialog v-model:visible="showDialog" header="Nieuwe factuur" modal :style="{ width: '720px' }" @hide="resetForm">
      <form @submit.prevent="createInvoice" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Factuurdatum</label>
            <Calendar v-model="form.issue_date" dateFormat="dd-mm-yy" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Vervaldatum</label>
            <Calendar v-model="form.due_date" dateFormat="dd-mm-yy" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">BTW-tarief</label>
            <InputNumber v-model="form.vat_rate" suffix="%" class="w-full" :min="0" :max="100" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Regelitems</label>
          <table class="w-full text-sm mb-2">
            <thead>
              <tr class="text-xs text-gray-400 uppercase border-b border-gray-200">
                <th class="text-left pb-1 pr-2" style="width:45%">Omschrijving</th>
                <th class="text-right pb-1 px-2" style="width:15%">Aantal</th>
                <th class="text-right pb-1 px-2" style="width:20%">Tarief</th>
                <th class="text-right pb-1 px-2" style="width:15%">Bedrag</th>
                <th style="width:5%"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in lineItems" :key="i" class="border-b border-gray-100">
                <td class="py-1 pr-2"><input v-model="item.description" class="input py-1 px-2 text-sm" placeholder="Omschrijving" /></td>
                <td class="py-1 px-2"><input v-model.number="item.quantity" type="number" min="0" step="any" class="input py-1 px-2 text-sm text-right w-full" @input="recalcItem(i)" /></td>
                <td class="py-1 px-2"><input v-model.number="item.unit_price" type="number" min="0" step="0.01" class="input py-1 px-2 text-sm text-right w-full" @input="recalcItem(i)" /></td>
                <td class="py-1 px-2 text-right text-gray-700">{{ formatCurrency(item.total) }}</td>
                <td class="py-1 pl-1"><button type="button" class="btn-icon text-red-400" @click="lineItems.splice(i, 1)" :disabled="lineItems.length === 1"><i class="pi pi-trash text-xs"></i></button></td>
              </tr>
            </tbody>
          </table>
          <button type="button" class="btn-secondary text-xs" @click="lineItems.push({ description: '', quantity: 1, unit_price: 0, total: 0 })">
            <i class="pi pi-plus text-xs"></i> Regel toevoegen
          </button>
          <p v-if="formErrors.line_items" class="field-error">{{ formErrors.line_items }}</p>
        </div>
        <div class="flex justify-end text-sm text-gray-600 gap-6 pt-1">
          <span>Subtotaal: <strong>{{ formatCurrency(subtotal) }}</strong></span>
          <span>BTW {{ form.vat_rate }}%: <strong>{{ formatCurrency(vatAmount) }}</strong></span>
          <span class="text-gray-900 font-semibold">Totaal: {{ formatCurrency(totalAmount) }}</span>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Notities</label>
          <textarea v-model="form.notes" class="input min-h-[40px]" />
        </div>
        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <button type="button" class="btn-secondary" @click="showDialog = false">Annuleren</button>
          <button type="submit" class="btn-primary" :disabled="saving">Aanmaken</button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { invoicesApi } from '@/modules/invoices/api'
import { useFormatting } from '@/composables/useFormatting'
import { useErrorHandler } from '@/composables/useErrorHandler'
import type { Invoice } from '@/modules/invoices/types'
import Dialog from 'primevue/dialog'
import Calendar from 'primevue/calendar'
import InputNumber from 'primevue/inputnumber'

interface LineItem { description: string; quantity: number; unit_price: number; total: number }

const props = defineProps<{ projectId: string; clientId: string }>()
const emit = defineEmits<{ (e: 'count-change', count: number): void }>()
const { formatDate, formatCurrency, statusColor, downloadBlob, toISODate } = useFormatting()
const { showError, showSuccess } = useErrorHandler()

const invoices = ref<Invoice[]>([])
const showDialog = ref(false)
const saving = ref(false)
const form = ref({ vat_rate: 21, issue_date: new Date(), due_date: new Date(Date.now() + 30 * 86400000), notes: '' })
const lineItems = ref<LineItem[]>([{ description: '', quantity: 1, unit_price: 0, total: 0 }])
const formErrors = ref<Record<string, string>>({})

const subtotal = computed(() => lineItems.value.reduce((s, i) => s + i.total, 0))
const vatAmount = computed(() => Math.round(subtotal.value * (form.value.vat_rate / 100) * 100) / 100)
const totalAmount = computed(() => subtotal.value + vatAmount.value)

onMounted(async () => {
  const { data } = await invoicesApi.list({ project_id: props.projectId })
  invoices.value = data
  emit('count-change', data.length)
})

function recalcItem(i: number) {
  const item = lineItems.value[i]
  item.total = Math.round((item.quantity || 0) * (item.unit_price || 0) * 100) / 100
}

function openDialog() {
  resetForm()
  showDialog.value = true
}

function resetForm() {
  form.value = { vat_rate: 21, issue_date: new Date(), due_date: new Date(Date.now() + 30 * 86400000), notes: '' }
  lineItems.value = [{ description: '', quantity: 1, unit_price: 0, total: 0 }]
  formErrors.value = {}
}

async function createInvoice() {
  formErrors.value = {}
  const items = lineItems.value.filter(i => i.description.trim())
  if (!items.length) {
    formErrors.value.line_items = 'Voeg minimaal één regelitem toe'
    return
  }
  saving.value = true
  try {
    await invoicesApi.create({
      client_id: props.clientId,
      project_id: props.projectId,
      vat_rate: form.value.vat_rate,
      issue_date: toISODate(form.value.issue_date),
      due_date: toISODate(form.value.due_date),
      notes: form.value.notes || undefined,
      line_items: items.map(i => ({
        description: i.description,
        quantity: String(i.quantity),
        unit_price: String(i.unit_price),
        total: String(i.total),
      })),
    })
    showDialog.value = false
    const { data } = await invoicesApi.list({ project_id: props.projectId })
    invoices.value = data
    emit('count-change', data.length)
    showSuccess('Factuur aangemaakt')
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status: number; data?: { detail: unknown } } }
    if (axiosErr.response?.status === 422) {
      const detail = axiosErr.response.data?.detail
      if (Array.isArray(detail)) {
        detail.forEach((e: { loc?: string[]; msg: string }) => {
          const field = e.loc?.slice(-1)[0] ?? 'line_items'
          formErrors.value[field] = e.msg
        })
      } else {
        formErrors.value.line_items = String(detail) || 'Validatiefout'
      }
    } else {
      showError(err)
    }
  }
  saving.value = false
}

async function markPaid(inv: Invoice) {
  try {
    await invoicesApi.markPaid(inv.id)
    const { data } = await invoicesApi.list({ project_id: props.projectId })
    invoices.value = data
    showSuccess('Factuur betaald')
  } catch (err) { showError(err) }
}

async function downloadPdf(inv: Invoice) {
  try {
    const { data } = await invoicesApi.downloadPdf(inv.id)
    downloadBlob(data, `factuur-${inv.invoice_number}.pdf`)
  } catch (err) { showError(err, 'PDF genereren mislukt') }
}

async function deleteInvoice(inv: Invoice) {
  try {
    await invoicesApi.delete(inv.id)
    invoices.value = invoices.value.filter(i => i.id !== inv.id)
    emit('count-change', invoices.value.length)
    showSuccess('Factuur verwijderd')
  } catch (err) { showError(err) }
}
</script>
