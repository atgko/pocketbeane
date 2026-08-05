import { useEffect, useState } from 'react'

// Sleeper equivalent of useYahooAuth — but there's no OAuth session to
// check on mount (Sleeper's API is unauthenticated), so "connected" here
// just means "we've resolved a username to a user_id before" persisted in
// localStorage, purely for onboarding convenience (don't make the user
// retype their username for every new Sleeper league). Nothing secret is
// stored — a Sleeper user_id is public data, same as a username.
const STORAGE_KEY = 'pocketbeane_sleeper_identity'

function readStored() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useSleeperAuth() {
  const [identity, setIdentity] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIdentity(readStored())
  }, [])

  const connect = async (username) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sleeper/resolve-user?username=${encodeURIComponent(username)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not find that Sleeper username')
      const resolved = { userId: data.userId, username: data.username, displayName: data.displayName }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved))
      setIdentity(resolved)
      return resolved
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const disconnect = () => {
    localStorage.removeItem(STORAGE_KEY)
    setIdentity(null)
  }

  return {
    connected: Boolean(identity?.userId),
    userId: identity?.userId ?? null,
    username: identity?.username ?? null,
    displayName: identity?.displayName ?? null,
    loading,
    error,
    connect,
    disconnect,
  }
}
