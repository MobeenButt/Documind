/**
 * api.js — Frontend ↔ Backend HTTP layer
 *
 * Authentication kaise bhejte hain?
 * Har protected request ke saath Authorization header bhejte hain:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
 *
 * Token Supabase session se aata hai (AuthContext mein available hai).
 * Backend yeh token verify karta hai aur user_id extract karta hai.
 */

import { supabase } from '../lib/supabase'

const BASE_URL = 'http://localhost:8000'

// ─── Token getter ──────────────────────────────────────────────────────────────
// Har request se pehle current session ka token lo.
// Supabase automatically token refresh karta hai jab expire hone wala ho.
async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

// ─── Base request helper ───────────────────────────────────────────────────────
async function request(path, options = {}, requireAuth = true) {
  const headers = { ...options.headers }

  if (requireAuth) {
    const token = await getToken()
    if (!token) {
      // Token nahi hai — user logged out ho gaya
      throw new Error('Not authenticated. Please login.')
    }
    // Authorization header add karo
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  let data
  try { data = await res.json() }
  catch { throw new Error(`Server returned non-JSON (${res.status})`) }

  if (!res.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    throw new Error(msg)
  }

  return data
}

// ─── Public endpoints (no auth) ───────────────────────────────────────────────
export async function checkHealth() {
  return request('/health', {}, false)   // No auth needed
}

// ─── Protected endpoints ──────────────────────────────────────────────────────

export async function uploadPDF(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request('/upload/', { method: 'POST', body: formData })
  // Note: No Content-Type header — browser sets multipart boundary automatically
}

export async function ingestDocument(doc_id) {
  return request('/ingest/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ doc_id }),
  })
}

export async function sendMessage(doc_id, question, n_results = 6) {
  return request('/chat/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ doc_id, question, n_results }),
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
