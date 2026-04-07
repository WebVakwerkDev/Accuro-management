import axios from 'axios'
import router from '@/router'

const apiUrl = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${apiUrl}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Response interceptor — handle 401 and refresh
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Cookie wordt automatisch meegestuurd door withCredentials
        const { data } = await axios.post(
          `${apiUrl}/api/v1/auth/refresh`,
          {},
          { withCredentials: true },
        )
        setAccessToken(data.access_token)
        processQueue(null, data.access_token)
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        setAccessToken(null)
        router.push('/login')
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
