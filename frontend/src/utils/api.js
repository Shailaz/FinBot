import axios from 'axios'

// The Vite development proxy handles routing so baseURL stays empty.
const BASE_URL = ''

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

export async function sendMessage(sessionId, message) {
  const { data } = await api.post('/chat', {
    session_id: sessionId || undefined,
    message,
  })
  return data
}

export async function resetSession(sessionId) {
  if (!sessionId) return
  await api.delete(`/session/${sessionId}`)
}
