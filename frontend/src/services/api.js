// ─── API Service ──────────────────────────────────────────────────────────────
// Single file for all backend calls.
// All pages import from here — if the base URL changes, only this file changes.

const BASE_URL = 'http://localhost:8000'

// ─── Generic request helper ───────────────────────────────────────────────────
// Handles fetch + JSON parse + error extraction in one place.
// Throws a plain Error with the backend's detail message so UI can display it.

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options)

  // Try to parse JSON regardless of status — backend always returns JSON
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error(`Server returned non-JSON response (${res.status})`)
  }

  if (!res.ok) {
    // FastAPI puts error messages in data.detail
    const msg = typeof data.detail === 'string'
      ? data.detail
      : JSON.stringify(data.detail)
    throw new Error(msg)
  }

  return data
}

// ─── Upload PDF ───────────────────────────────────────────────────────────────
// POST /upload/  multipart/form-data
// Returns: { success, doc_id, filename, total_pages, file_size_mb, pages_extracted }

export async function uploadPDF(file) {
  const formData = new FormData()
  // Key name 'file' must match FastAPI's parameter name: upload_pdf(file: UploadFile)
  formData.append('file', file)

  return request('/upload/', {
    method: 'POST',
    // Do NOT set Content-Type header manually — browser sets it automatically
    // with the correct multipart boundary when using FormData
    body: formData,
  })
}

// ─── Ingest Document ──────────────────────────────────────────────────────────
// POST /ingest/  JSON body
// Returns: { success, doc_id, total_chunks, doc_type_detected, chunk_size_used, ... }

export async function ingestDocument(doc_id) {
  return request('/ingest/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id }),
  })
}

// ─── Send Chat Message ────────────────────────────────────────────────────────
// POST /chat/  JSON body
// Returns: { success, answer, citations, chunks_used, model, relevant_chunks }

export async function sendMessage(doc_id, question, n_results = 6) {
  return request('/chat/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id, question, n_results }),
  })
}

// ─── Health Check ─────────────────────────────────────────────────────────────
// GET /health
// Used by Navbar to show API status dot

export async function checkHealth() {
  return request('/health')
}

// ─── Check Ingest Status ──────────────────────────────────────────────────────
// GET /ingest/status/{doc_id}
// Useful if you want to poll before chatting

export async function checkIngestStatus(doc_id) {
  return request(`/ingest/status/${doc_id}`)
}
