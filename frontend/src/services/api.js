const BASE_URL = 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options)
  let data
  try { data = await res.json() }
  catch { throw new Error(`Server returned non-JSON (${res.status})`) }
  if (!res.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    throw new Error(msg)
  }
  return data
}

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

export async function checkHealth() {
  return request('/health')
}
