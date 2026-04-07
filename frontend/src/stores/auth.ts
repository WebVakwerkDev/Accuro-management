import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/services'
import { setAccessToken } from '@/api/client'
import type { User } from '@/api/types'
import router from '@/router'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const isFinance = computed(() => user.value?.role === 'FINANCE')
  const isEmployee = computed(() => user.value?.role === 'EMPLOYEE')
  const role = computed(() => user.value?.role || '')

  function hasRole(...roles: string[]) {
    return roles.includes(role.value)
  }

  async function init() {
    // Cookie wordt automatisch meegestuurd — geen localStorage nodig
    try {
      const { data: tokens } = await authApi.refresh()
      setAccessToken(tokens.access_token)
      const { data: me } = await authApi.me()
      user.value = me
    } catch {
      // Geen geldige cookie — gebruiker is uitgelogd
      setAccessToken(null)
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    const { data } = await authApi.login(email, password)
    setAccessToken(data.access_token)
    const { data: me } = await authApi.me()
    user.value = me
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch { /* ignore */ }
    setAccessToken(null)
    user.value = null
    router.push('/login')
  }

  return { user, loading, isAuthenticated, isAdmin, isFinance, isEmployee, role, hasRole, init, login, logout }
})
