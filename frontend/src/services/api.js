/**
 * api.js — Frontend ↔ Backend HTTP layer.
 *
 * Token storage uses localStorage with sessionStorage as a fallback,
 * and finally an in-memory variable if both are blocked (e.g. iframe).
 */

const TOKEN_KEY = 'documind_token'

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ─── Token storage (localStorage → sessionStorage → memory) ───────────────────
let _memToken = null   // last-resort in-memory fallback

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { /* blocked */ }
  try { return sessionStorage.getItem(TOKEN_KEY) } catch { /* blocked */ }
  return _memToken
}

export function setToken(token) {
  _memToken = token || null
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else        localStorage.removeItem(TOKEN_KEY)
    return
  } catch { /* blocked */ }
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else        sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* blocked — in-memory only */ }
}

export function clearToken() {
  _memToken = null
  try { localStorage.removeItem(TOKEN_KEY) }   catch { /* blocked */ }
  try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* blocked */ }
}

async function request(path, options = {}, requireAuth = true) {
  const headers = { ...options.headers }

  if (requireAuth) {
    const token = getToken()
    if (!token) {
      throw new Error('Not authenticated. Please log in.')
    }
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  let data
  try { data = await res.json() }
  catch { throw new Error(`Server returned an invalid response (${res.status})`) }

  if (!res.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    throw new Error(msg || 'Request failed.')
  }

  return data
}

// ─── Public ───────────────────────────────────────────────────────────────────
export async function checkHealth() {
  return request('/health', {}, false)
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export async function signup(email, password) {
  return request('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, false)
}

export async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, false)
}

// ─── Protected ─────────────────────────────────────────────────────────────────
export async function uploadPDF(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request('/upload/', { method: 'POST', body: formData })
}

export async function ingestDocument(doc_id) {
  return request('/ingest/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id }),
  })
}

export async function sendMessage(doc_id, question, n_results = 6) {
  return request('/chat/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id, question, n_results }),
  })
}

export async function getDocuments() {
  return request('/documents/')
}

export async function deleteDocument(doc_id) {
  return request(`/documents/${doc_id}`, { method: 'DELETE' })
}

export async function getChatHistory(doc_id) {
  return request(`/chat/history/${doc_id}`)
}

export async function checkIngestStatus(doc_id) {
  return request(`/ingest/status/${doc_id}`)
}
