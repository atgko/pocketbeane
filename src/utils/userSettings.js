const EMAIL_KEY = 'pocketbeane_user_email'

export function getUserEmail() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(EMAIL_KEY) || null
}

export function saveUserEmail(email) {
  if (typeof window === 'undefined') return
  localStorage.setItem(EMAIL_KEY, email)
}

export function clearUserEmail() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(EMAIL_KEY)
}
