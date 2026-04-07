<template>
  <div v-if="loading" class="space-y-6">
    <div class="flex items-center gap-4"><div class="skeleton h-5 w-5 rounded"></div><div class="skeleton h-7 w-64"></div><div class="skeleton h-5 w-20 rounded-md"></div></div>
    <div class="skeleton h-20 w-full rounded-lg"></div>
    <div class="flex gap-6 border-b border-gray-200 pb-3"><div v-for="i in 6" :key="i" class="skeleton h-4 w-24"></div></div>
  </div>

  <div v-else-if="project" class="space-y-6 animate-slide-up">
    <!-- Header -->
    <div class="flex items-start gap-4">
      <button @click="$router.push('/projects')" class="btn-icon mt-0.5"><i class="pi pi-arrow-left text-sm"></i></button>
      <div class="flex-1">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-gray-900">{{ project.name }}</h2>
          <span :class="statusColor(project.status)" class="badge">{{ statusLabel(project.status) }}</span>
          <div class="flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full" :class="statusDot(project.priority)"></div><span class="text-xs font-mono text-gray-500">{{ statusLabel(project.priority) }}</span></div>
        </div>
        <p class="text-xs font-mono text-gray-500 mt-1">{{ project.client?.company_name }} · {{ project.project_type?.replace(/_/g, ' ') }} · <span class="text-gray-400">{{ project.slug }}</span></p>
    <!-- Extra metadata voor automatisering/software -->
    <div v-if="project.tools_used?.length || project.delivery_form || project.recurring_fee" class="flex flex-wrap gap-3 mt-2">
      <div v-if="project.tools_used?.length" class="flex items-center gap-1.5">
        <span class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Tools</span>
        <div class="flex flex-wrap gap-1">
          <span v-for="tool in project.tools_used" :key="tool" class="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded">{{ tool }}</span>
        </div>
      </div>
      <div v-if="project.delivery_form" class="flex items-center gap-1.5">
        <span class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Levering</span>
        <span class="text-xs text-gray-600">{{ project.delivery_form }}</span>
      </div>
      <div v-if="project.recurring_fee" class="flex items-center gap-1.5">
        <span class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Abonnement</span>
        <span class="text-xs font-mono text-gray-700">{{ formatCurrency(project.recurring_fee) }}/mnd</span>
      </div>
    </div>
      </div>
      <button class="btn-secondary" @click="showEditDialog = true"><i class="pi pi-pencil text-xs"></i> Bewerken</button>
    </div>

    <!-- Description -->
    <div v-if="project.description" class="card p-5">
      <h3 class="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Beschrijving</h3>
      <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ project.description }}</p>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="flex gap-1">
        <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key"
          class="px-3 py-2 text-xs font-medium transition-colors rounded-t-md"
          :class="activeTab === tab.key ? 'text-blue-600 bg-white border border-gray-200 border-b-white -mb-px' : 'text-gray-500 hover:text-gray-700'">
          {{ tab.label }} <span class="font-mono text-gray-400 ml-1">{{ tabCounts[tab.key] }}</span>
        </button>
      </nav>
    </div>

    <!-- Tab Components -->
    <CommunicationTab v-if="activeTab === 'communication'" :project-id="project.id" @count-change="tabCounts.communication = $event" />
    <TasksTab v-if="activeTab === 'tasks'" :project-id="project.id" @count-change="tabCounts.tasks = $event" />
    <NotesTab v-if="activeTab === 'notes'" :project-id="project.id" @count-change="tabCounts.notes = $event" />
    <RepositoriesTab v-if="activeTab === 'repositories'" :project-id="project.id" @count-change="tabCounts.repositories = $event" />
    <LinksTab v-if="activeTab === 'links'" :project-id="project.id" @count-change="tabCounts.links = $event" />
    <ProposalsTab v-if="activeTab === 'proposals'" :project-id="project.id" :client-id="project.client_id" :client="project.client ?? null" @count-change="tabCounts.proposals = $event" />
    <InvoicesTab v-if="activeTab === 'invoices'" :project-id="project.id" :client-id="project.client_id" @count-change="tabCounts.invoices = $event" />

    <!-- Edit Project Dialog -->
    <Dialog v-model:visible="showEditDialog" header="Project bewerken" modal :style="{ width: '560px' }">
      <form @submit.prevent="updateProject" class="space-y-4">
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Projectnaam</label><input v-model="editForm.name" class="input" /></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Status</label><Dropdown v-model="editForm.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" /></div>
          <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Prioriteit</label><Dropdown v-model="editForm.priority" :options="priorityOptions" optionLabel="label" optionValue="value" class="w-full" /></div>
        </div>
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Beschrijving</label><textarea v-model="editForm.description" class="input min-h-[80px]" /></div>

        <!-- Tools gebruikt -->
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Tools gebruikt</label>
          <input v-model="editToolsInput" class="input" placeholder="Make, n8n, OpenAI (komma-gescheiden)" @blur="parseToolsInput" />
          <div v-if="editForm.tools_used?.length" class="flex flex-wrap gap-1.5 mt-2">
            <span v-for="tool in editForm.tools_used" :key="tool"
              class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
              {{ tool }}
              <button type="button" @click="editForm.tools_used = (editForm.tools_used ?? []).filter((t: string) => t !== tool)" class="hover:text-blue-900">&times;</button>
            </span>
          </div>
        </div>

        <!-- Leveringsvorm + Maandelijks tarief -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Leveringsvorm</label>
            <Dropdown v-model="editForm.delivery_form" :options="deliveryFormOptions" optionLabel="label" optionValue="value" placeholder="Selecteer" showClear class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Maandelijks tarief</label>
            <InputNumber v-model="editForm.recurring_fee" mode="currency" currency="EUR" locale="nl-NL" class="w-full" placeholder="Optioneel" />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <button type="button" class="btn-secondary" @click="showEditDialog = false">Annuleren</button>
          <button type="submit" class="btn-primary" :disabled="saving">Opslaan</button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectsApi } from '../api'
import { useFormatting } from '@/composables/useFormatting'
import { useErrorHandler } from '@/composables/useErrorHandler'
import type { Project, ProjectUpdate } from '../types'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import CommunicationTab from '../components/CommunicationTab.vue'
import TasksTab from '../components/TasksTab.vue'
import NotesTab from '../components/NotesTab.vue'
import RepositoriesTab from '../components/RepositoriesTab.vue'
import LinksTab from '../components/LinksTab.vue'
import InvoicesTab from '../components/InvoicesTab.vue'
import ProposalsTab from '../components/ProposalsTab.vue'

const route = useRoute()
const router = useRouter()
const { showError, showSuccess } = useErrorHandler()
const { formatCurrency, statusColor, statusDot, statusLabel } = useFormatting()

const project = ref<Project | null>(null)
const loading = ref(true)
const saving = ref(false)
const activeTab = ref('communication')
const showEditDialog = ref(false)
const editForm = ref<ProjectUpdate>({})
const editToolsInput = ref('')

const tabCounts = reactive<Record<string, number>>({
  communication: 0, tasks: 0, notes: 0, repositories: 0, links: 0, proposals: 0, invoices: 0,
})

const tabs = [
  { key: 'communication', label: 'Communicatie' },
  { key: 'tasks', label: 'Taken' },
  { key: 'notes', label: 'Notities' },
  { key: 'repositories', label: 'Repos' },
  { key: 'links', label: 'Links' },
  { key: 'proposals', label: 'Offertes' },
  { key: 'invoices', label: 'Facturen' },
]

const statusOptions = [
  { label: 'Lead', value: 'LEAD' },
  { label: 'Intake', value: 'INTAKE' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Testen', value: 'TESTING' },
  { label: 'Wachtend', value: 'WAITING_FOR_CLIENT' },
  { label: 'Review', value: 'REVIEW' },
  { label: 'Afgerond', value: 'COMPLETED' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Onderhoud', value: 'MAINTENANCE' },
  { label: 'Gepauzeerd', value: 'PAUSED' },
]
const priorityOptions = [
  { label: 'Laag', value: 'LOW' }, { label: 'Gemiddeld', value: 'MEDIUM' },
  { label: 'Hoog', value: 'HIGH' }, { label: 'Urgent', value: 'URGENT' },
]
const deliveryFormOptions = [
  { label: 'SaaS', value: 'SaaS' },
  { label: 'Self-hosted', value: 'self-hosted' },
  { label: 'Embedded', value: 'embedded' },
]

function parseToolsInput() {
  if (!editToolsInput.value.trim()) return
  const parsed = editToolsInput.value.split(',').map(t => t.trim()).filter(Boolean)
  const existing = editForm.value.tools_used ?? []
  editForm.value.tools_used = [...new Set([...existing, ...parsed])]
  editToolsInput.value = ''
}

onMounted(async () => {
  const id = route.params.id as string
  try {
    const { data } = await projectsApi.get(id)
    project.value = data
    editForm.value = {
      name: data.name,
      status: data.status,
      priority: data.priority,
      description: data.description ?? undefined,
      tools_used: data.tools_used ?? [],
      delivery_form: data.delivery_form ?? null,
      recurring_fee: data.recurring_fee ? parseFloat(data.recurring_fee) : null,
    }
  } catch (err) {
    showError(err, 'Project laden mislukt')
    router.push('/projects')
  }
  loading.value = false
})

async function updateProject() {
  if (!project.value) return
  saving.value = true
  try {
    const { data } = await projectsApi.update(project.value.id, editForm.value)
    Object.assign(project.value, data)
    showEditDialog.value = false
    showSuccess('Bijgewerkt')
  } catch (err) { showError(err) }
  saving.value = false
}
</script>
