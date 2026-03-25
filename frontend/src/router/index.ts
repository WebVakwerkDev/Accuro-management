import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'clients', name: 'clients', component: () => import('@/views/ClientsView.vue'), meta: { roles: ['ADMIN', 'EMPLOYEE', 'FINANCE'] } },
        { path: 'clients/:id', name: 'client-detail', component: () => import('@/views/ClientDetailView.vue'), meta: { roles: ['ADMIN', 'EMPLOYEE', 'FINANCE'] } },
        { path: 'projects', name: 'projects', component: () => import('@/views/ProjectsView.vue'), meta: { roles: ['ADMIN', 'EMPLOYEE'] } },
        { path: 'projects/:id', name: 'project-detail', component: () => import('@/views/ProjectDetailView.vue'), meta: { roles: ['ADMIN', 'EMPLOYEE'] } },
        { path: 'invoices', name: 'invoices', component: () => import('@/views/InvoicesView.vue'), meta: { roles: ['ADMIN', 'FINANCE'] } },
        { path: 'proposals', name: 'proposals', component: () => import('@/views/ProposalsView.vue'), meta: { roles: ['ADMIN', 'EMPLOYEE'] } },
        { path: 'tasks', name: 'tasks', component: () => import('@/views/TasksView.vue'), meta: { roles: ['ADMIN', 'EMPLOYEE'] } },
        { path: 'time-entries', name: 'time-entries', component: () => import('@/views/TimeEntriesView.vue'), meta: { roles: ['ADMIN', 'EMPLOYEE'] } },
        { path: 'expenses', name: 'expenses', component: () => import('@/views/ExpensesView.vue'), meta: { roles: ['ADMIN', 'FINANCE'] } },
        { path: 'finance', name: 'finance', component: () => import('@/views/FinanceView.vue'), meta: { roles: ['ADMIN', 'FINANCE'] } },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { roles: ['ADMIN'] } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()

  // Wait for auth initialization
  if (auth.loading) {
    await new Promise<void>((resolve) => {
      const unwatch = auth.$subscribe(() => {
        if (!auth.loading) {
          unwatch()
          resolve()
        }
      })
      // Fallback timeout
      setTimeout(() => { unwatch(); resolve() }, 3000)
    })
  }

  if (to.meta.public) {
    if (auth.isAuthenticated) return next('/')
    return next()
  }

  if (!auth.isAuthenticated) {
    return next('/login')
  }

  if (to.meta.roles && !auth.hasRole(...(to.meta.roles as string[]))) {
    return next('/')
  }

  next()
})

export default router
