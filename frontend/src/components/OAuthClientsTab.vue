<template>
  <div class="card">
    <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
      <h2 class="text-sm font-medium text-gray-800">Applicaties</h2>
      <button class="btn-primary text-xs" @click="openCreateDialog">
        <i class="pi pi-plus text-xs"></i> Nieuwe applicatie
      </button>
    </div>

    <div class="light-table">
      <DataTable :value="clients" stripedRows>
        <Column field="name" header="Naam">
          <template #body="{ data }">
            <span class="text-gray-800 font-medium">{{ data.name }}</span>
          </template>
        </Column>
        <Column field="client_id" header="Client ID">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-gray-500">{{ data.client_id }}</span>
              <button class="btn-icon" @click="copyToClipboard(data.client_id)" title="Kopiëren">
                <i class="pi pi-copy text-xs text-gray-400"></i>
              </button>
            </div>
          </template>
        </Column>
        <Column field="allowed_scopes" header="Scopes">
          <template #body="{ data }">
            <span class="font-mono text-xs text-gray-500">{{ data.allowed_scopes }}</span>
          </template>
        </Column>
        <Column field="is_active" header="Status" style="width:90px">
          <template #body="{ data }">
            <span
              class="badge"
              :class="data.is_active
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-gray-50 text-gray-400 border border-gray-200'"
            >
              {{ data.is_active ? 'Actief' : 'Inactief' }}
            </span>
          </template>
        </Column>
        <Column header="" style="width:120px">
          <template #body="{ data }">
            <div class="flex gap-1">
              <button class="btn-icon" @click="openEditDialog(data)" title="Bewerken">
                <i class="pi pi-pencil text-xs text-gray-400"></i>
              </button>
              <button class="btn-icon" @click="confirmRegenerate(data)" title="Nieuw secret">
                <i class="pi pi-refresh text-xs text-blue-400"></i>
              </button>
              <button class="btn-icon text-red-600" @click="confirmDelete(data)" title="Verwijderen">
                <i class="pi pi-trash text-xs"></i>
              </button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>

  <!-- Aanmaken dialog -->
  <Dialog v-model:visible="showCreateDialog" header="Nieuwe applicatie" modal :style="{ width: '480px' }">
    <form @submit.prevent="createClient" class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
          Naam <span class="text-red-400">*</span>
        </label>
        <input v-model="createForm.name" class="input" required />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
          Redirect URIs <span class="text-red-400">*</span>
        </label>
        <Chips
          v-model="createForm.redirect_uris"
          class="w-full"
          placeholder="Voer URI in en druk Enter"
          :pt="{ container: { class: 'input p-0 flex flex-wrap gap-1 min-h-[38px]' } }"
        />
        <p class="text-[10px] text-gray-400 mt-1">Typ een URI en druk op Enter om toe te voegen</p>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Scopes</label>
        <input v-model="createForm.allowed_scopes" class="input font-mono" />
        <p class="text-[10px] text-gray-400 mt-1">Komma-gescheiden, bijv. openid profile email</p>
      </div>
      <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
        <button type="button" class="btn-secondary" @click="showCreateDialog = false">Annuleren</button>
        <button type="submit" class="btn-primary" :disabled="saving">Aanmaken</button>
      </div>
    </form>
  </Dialog>

  <!-- Bewerken dialog -->
  <Dialog v-model:visible="showEditDialog" header="Applicatie bewerken" modal :style="{ width: '480px' }">
    <form @submit.prevent="updateClient" class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Client ID</label>
        <input :value="editForm.client_id" class="input font-mono bg-gray-50" readonly />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
          Naam <span class="text-red-400">*</span>
        </label>
        <input v-model="editForm.name" class="input" required />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Redirect URIs</label>
        <Chips
          v-model="editForm.redirect_uris"
          class="w-full"
          placeholder="Voer URI in en druk Enter"
          :pt="{ container: { class: 'input p-0 flex flex-wrap gap-1 min-h-[38px]' } }"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Scopes</label>
        <input v-model="editForm.allowed_scopes" class="input font-mono" />
      </div>
      <div class="flex items-center gap-3">
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Actief</label>
        <ToggleButton
          v-model="editForm.is_active"
          onLabel="Actief"
          offLabel="Inactief"
          class="text-xs"
        />
      </div>
      <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
        <button type="button" class="btn-secondary" @click="showEditDialog = false">Annuleren</button>
        <button type="submit" class="btn-primary" :disabled="saving">Opslaan</button>
      </div>
    </form>
  </Dialog>

  <!-- Secret modal (aanmaken of regenereren) -->
  <Dialog
    v-model:visible="showSecretModal"
    header="Sla je gegevens op"
    modal
    :closable="secretConfirmed"
    :style="{ width: '480px' }"
  >
    <div class="space-y-4">
      <div class="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <i class="pi pi-exclamation-triangle text-yellow-500 mt-0.5"></i>
        <p class="text-xs text-yellow-700">
          <strong>Sla dit op — je ziet het nooit meer.</strong> Na het sluiten van dit venster is het secret niet meer op te vragen.
        </p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Client ID</label>
        <div class="flex gap-2">
          <input :value="revealedSecret.client_id" class="input font-mono flex-1 bg-gray-50" readonly />
          <button type="button" class="btn-secondary px-3" @click="copyToClipboard(revealedSecret.client_id)">
            <i class="pi pi-copy text-xs"></i>
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Client Secret</label>
        <div class="flex gap-2">
          <input :value="revealedSecret.client_secret" class="input font-mono flex-1 bg-gray-50 text-xs" readonly />
          <button type="button" class="btn-secondary px-3" @click="copyToClipboard(revealedSecret.client_secret)">
            <i class="pi pi-copy text-xs"></i>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-2">
        <input id="secret-confirm" type="checkbox" v-model="secretConfirmed" class="rounded" />
        <label for="secret-confirm" class="text-xs text-gray-600 cursor-pointer">
          Ik heb het secret gekopieerd en opgeslagen
        </label>
      </div>

      <div class="flex justify-end pt-3 border-t border-gray-200">
        <button
          type="button"
          class="btn-primary"
          :disabled="!secretConfirmed"
          @click="showSecretModal = false; secretConfirmed = false"
        >
          Sluiten
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Chips from 'primevue/chips'
import ToggleButton from 'primevue/togglebutton'
import { useConfirm } from 'primevue/useconfirm'
import { oauthClientsApi } from '@/api/services'
import { useErrorHandler } from '@/composables/useErrorHandler'
import type { OAuthClient } from '@/api/types'

const confirm = useConfirm()
const { showError, showSuccess } = useErrorHandler()

const clients = ref<OAuthClient[]>([])
const saving = ref(false)

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showSecretModal = ref(false)
const secretConfirmed = ref(false)

const createForm = ref({ name: '', redirect_uris: [] as string[], allowed_scopes: 'openid profile email' })
const editForm = ref({ client_id: '', name: '', redirect_uris: [] as string[], allowed_scopes: '', is_active: true })
const revealedSecret = ref({ client_id: '', client_secret: '' })

onMounted(async () => {
  await loadClients()
})

async function loadClients() {
  try {
    const { data } = await oauthClientsApi.list()
    clients.value = data
  } catch (err) {
    showError(err)
  }
}

function openCreateDialog() {
  createForm.value = { name: '', redirect_uris: [], allowed_scopes: 'openid profile email' }
  showCreateDialog.value = true
}

function openEditDialog(client: OAuthClient) {
  editForm.value = {
    client_id: client.client_id,
    name: client.name,
    redirect_uris: [...client.redirect_uris],
    allowed_scopes: client.allowed_scopes,
    is_active: client.is_active,
  }
  showEditDialog.value = true
}

async function createClient() {
  if (!createForm.value.redirect_uris.length) {
    showError({ message: 'Voeg minimaal één redirect URI toe' })
    return
  }
  saving.value = true
  try {
    const { data } = await oauthClientsApi.create(createForm.value)
    showCreateDialog.value = false
    revealedSecret.value = { client_id: data.client_id, client_secret: data.client_secret }
    secretConfirmed.value = false
    showSecretModal.value = true
    await loadClients()
    showSuccess('Applicatie aangemaakt')
  } catch (err: any) {
    if (err.response?.status === 409) {
      showError({ message: 'Een applicatie met deze naam bestaat al' })
    } else {
      showError(err)
    }
  }
  saving.value = false
}

async function updateClient() {
  saving.value = true
  try {
    await oauthClientsApi.update(editForm.value.client_id, {
      name: editForm.value.name,
      redirect_uris: editForm.value.redirect_uris,
      allowed_scopes: editForm.value.allowed_scopes,
      is_active: editForm.value.is_active,
    })
    showEditDialog.value = false
    await loadClients()
    showSuccess('Opgeslagen')
  } catch (err) {
    showError(err)
  }
  saving.value = false
}

function confirmRegenerate(client: OAuthClient) {
  confirm.require({
    message: `Dit maakt het huidige secret van "${client.name}" ongeldig. Doorgaan?`,
    header: 'Secret regenereren',
    acceptLabel: 'Ja, regenereren',
    rejectLabel: 'Annuleren',
    acceptClass: 'p-button-warning',
    accept: async () => {
      try {
        const { data } = await oauthClientsApi.regenerateSecret(client.client_id)
        revealedSecret.value = { client_id: data.client_id, client_secret: data.client_secret }
        secretConfirmed.value = false
        showSecretModal.value = true
        showSuccess('Nieuw secret gegenereerd')
      } catch (err) {
        showError(err)
      }
    },
  })
}

function confirmDelete(client: OAuthClient) {
  confirm.require({
    message: `Applicatie "${client.name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    header: 'Verwijderen',
    acceptLabel: 'Verwijderen',
    rejectLabel: 'Annuleren',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await oauthClientsApi.remove(client.client_id)
        await loadClients()
        showSuccess('Verwijderd')
      } catch (err) {
        showError(err)
      }
    },
  })
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess('Gekopieerd')
  } catch {
    showError({ message: 'Kopiëren mislukt' })
  }
}
</script>
