<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <button class="btn-secondary text-xs" @click="showDialog = true"><i class="pi pi-plus text-xs"></i> Toevoegen</button>
    </div>
    <div v-for="repo in repositories" :key="repo.id" class="card p-4 flex justify-between items-center">
      <div>
        <a :href="repo.repo_url" target="_blank" class="text-sm font-medium text-green-600 hover:text-green-700 transition-colors">{{ repo.repo_name }}</a>
        <p class="text-[11px] font-mono text-gray-400">{{ repo.default_branch }}</p>
      </div>
      <button class="btn-icon text-red-600" @click="deleteRepo(repo.id)"><i class="pi pi-trash text-xs"></i></button>
    </div>
    <p v-if="!repositories.length" class="text-center text-sm text-gray-400 py-8">Geen repositories</p>

    <Dialog v-model:visible="showDialog" header="Repository toevoegen" modal :style="{ width: '440px' }">
      <form @submit.prevent="addRepo" class="space-y-4">
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Naam</label><input v-model="form.repo_name" class="input" placeholder="owner/repo" required /></div>
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">URL</label><input v-model="form.repo_url" class="input" placeholder="https://github.com/..." required /></div>
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Default branch</label><input v-model="form.default_branch" class="input" /></div>
        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <button type="button" class="btn-secondary" @click="showDialog = false">Annuleren</button>
          <button type="submit" class="btn-primary" :disabled="saving">Toevoegen</button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { repositoriesApi } from '@/modules/projects/api'
import { useErrorHandler } from '@/composables/useErrorHandler'
import Dialog from 'primevue/dialog'

interface Repository { id: string; repo_name: string; repo_url: string; default_branch: string }

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ (e: 'count-change', count: number): void }>()
const { showError } = useErrorHandler()

const repositories = ref<Repository[]>([])
const showDialog = ref(false)
const saving = ref(false)
const form = ref({ repo_name: '', repo_url: '', default_branch: 'main' })

onMounted(async () => {
  const { data } = await repositoriesApi.list(props.projectId)
  repositories.value = data
  emit('count-change', data.length)
})

async function addRepo() {
  saving.value = true
  try {
    await repositoriesApi.create(props.projectId, form.value)
    showDialog.value = false
    form.value = { repo_name: '', repo_url: '', default_branch: 'main' }
    const { data } = await repositoriesApi.list(props.projectId)
    repositories.value = data
    emit('count-change', data.length)
  } catch (err) { showError(err) }
  saving.value = false
}

async function deleteRepo(id: string) {
  try {
    await repositoriesApi.delete(id)
    repositories.value = repositories.value.filter(r => r.id !== id)
    emit('count-change', repositories.value.length)
  } catch (err) { showError(err) }
}
</script>
