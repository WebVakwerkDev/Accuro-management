<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <button class="btn-secondary text-xs" @click="showDialog = true"><i class="pi pi-plus text-xs"></i> Toevoegen</button>
    </div>
    <div v-for="link in links" :key="link.id" class="card p-4 flex justify-between items-center">
      <div>
        <a :href="link.url" target="_blank" class="text-sm font-medium text-green-600 hover:text-green-700 transition-colors">{{ link.label }}</a>
        <p v-if="link.description" class="text-[11px] text-gray-500">{{ link.description }}</p>
      </div>
      <button class="btn-icon text-red-600" @click="deleteLink(link.id)"><i class="pi pi-trash text-xs"></i></button>
    </div>
    <p v-if="!links.length" class="text-center text-sm text-gray-400 py-8">Geen links</p>

    <Dialog v-model:visible="showDialog" header="Link toevoegen" modal :style="{ width: '440px' }">
      <form @submit.prevent="addLink" class="space-y-4">
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Label</label><input v-model="form.label" class="input" required /></div>
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">URL</label><input v-model="form.url" class="input" placeholder="https://..." required /></div>
        <div><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Beschrijving</label><input v-model="form.description" class="input" /></div>
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
import { linksApi } from '@/modules/projects/api'
import { useErrorHandler } from '@/composables/useErrorHandler'
import Dialog from 'primevue/dialog'

interface Link { id: string; label: string; url: string; description: string | null }

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ (e: 'count-change', count: number): void }>()
const { showError } = useErrorHandler()

const links = ref<Link[]>([])
const showDialog = ref(false)
const saving = ref(false)
const form = ref({ label: '', url: '', description: '' })

onMounted(async () => {
  const { data } = await linksApi.list(props.projectId)
  links.value = data
  emit('count-change', data.length)
})

async function addLink() {
  saving.value = true
  try {
    await linksApi.create(props.projectId, form.value)
    showDialog.value = false
    form.value = { label: '', url: '', description: '' }
    const { data } = await linksApi.list(props.projectId)
    links.value = data
    emit('count-change', data.length)
  } catch (err) { showError(err) }
  saving.value = false
}

async function deleteLink(id: string) {
  try {
    await linksApi.delete(id)
    links.value = links.value.filter(l => l.id !== id)
    emit('count-change', links.value.length)
  } catch (err) { showError(err) }
}
</script>
