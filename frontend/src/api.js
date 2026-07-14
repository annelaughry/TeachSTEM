import axios from 'axios'

// In dev, Vite proxies /api to localhost:8000 (see vite.config.js), so the
// relative path works. In production the React app is served from S3/
// CloudFront while Django lives on its own domain, so VITE_API_BASE_URL
// must point at that domain (e.g. https://api.yourdomain.org/api/),
// set at build time -- see .github/workflows/deploy.yml and DEPLOYMENT.md.
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/'

const api = axios.create({ baseURL })

// Attach JWT to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-refresh on 401
api.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const { data } = await axios.post(`${baseURL}auth/refresh/`, { refresh })
          localStorage.setItem('access', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.removeItem('access')
          localStorage.removeItem('refresh')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
