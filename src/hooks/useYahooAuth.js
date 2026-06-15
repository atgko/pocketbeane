import { useEffect, useState } from 'react'

export function useYahooAuth() {
  const [state, setState] = useState({ connected: false, screenName: null, loading: true })

  useEffect(() => {
    fetch('/api/auth/yahoo/me')
      .then((r) => r.json())
      .then((data) => setState({ connected: data.connected, screenName: data.screenName ?? null, loading: false }))
      .catch(() => setState({ connected: false, screenName: null, loading: false }))
  }, [])

  const disconnect = async () => {
    await fetch('/api/auth/yahoo/disconnect', { method: 'POST' })
    setState({ connected: false, screenName: null, loading: false })
  }

  return { ...state, disconnect }
}
