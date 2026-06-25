const SESSION_KEY = 'pb_session_id'

export function getSessionId() {
  if (typeof window === 'undefined') return null
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}
