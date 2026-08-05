import { useEffect, useRef } from 'react'
import useLeagueStore from '@/store/leagueStore'

const POLL_INTERVAL_MS = 8000

// Polls a live Sleeper draft and mirrors its picks into the local league
// store, so PocketBeane's board reflects what's actually happening on
// Sleeper in near-real-time — the user drafts on Sleeper's own site/app and
// uses PocketBeane purely as the recommendation panel. Yahoo has no
// equivalent live feed to poll (see memory
// project_sleeper_integration_scope / this-is-a-new-generic-tower.md), so
// Yahoo leagues keep the existing manually-clicked board, unchanged.
//
// Deliberately dumb about conflicts: Sleeper is the sole source of truth
// once this is active — every poll wholesale-replaces the local picks list
// with Sleeper's current picks (filtered to ones PocketBeane can match to
// its own player pool), rather than trying to merge/reconcile with
// manually-added local picks. Don't also manually click picks into the
// board for a live-synced Sleeper draft; the next poll will overwrite them.
export function useSleeperLiveDraftSync(league) {
  const setDraftPicks = useLeagueStore((s) => s.setDraftPicks)
  // Tracks Sleeper's raw pick count (matched + unmatched) — NOT
  // league.draft.picks.length, which only reflects matched picks after
  // filtering. Comparing against the raw count avoids re-polling forever
  // when an unmatched player is picked (matched count wouldn't move).
  const lastRawTotalRef = useRef(0)

  const isSleeperLeague = league?.config?.platform === 'sleeper'
  const draftId = league?.config?.sleeperDraftId
  const userId = league?.config?.sleeperUserId
  const leagueId = league?.id
  const totalSlots = league?.rosterSlots?.length ?? 0
  const userPickCount = (league?.draft?.picks ?? []).filter((p) => p.draftedBy === 'user').length
  // Once the user's own roster is full there's nothing left worth syncing
  // — draft.jsx's isDraftComplete flips off this same picks array and
  // swaps to DraftRecap on the next render, ending the loop naturally.
  const shouldPoll = Boolean(isSleeperLeague && draftId && totalSlots > 0 && userPickCount < totalSlots)

  useEffect(() => {
    if (!shouldPoll) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/sleeper/sync-draft?draftId=${encodeURIComponent(draftId)}&userId=${encodeURIComponent(userId ?? '')}`)
        const data = await res.json()
        if (cancelled || !res.ok) return
        if (data.total !== lastRawTotalRef.current) {
          const picks = (data.picks ?? [])
            .filter((p) => p.playerId !== null)
            .map(({ playerId, pickNumber, draftedBy }) => ({ playerId, pickNumber, draftedBy, price: null }))
          setDraftPicks(leagueId, picks)
          lastRawTotalRef.current = data.total
        }
      } catch {
        // Transient network/API hiccup — just try again on the next tick.
      }
    }

    poll() // check immediately on activation, don't wait a full interval
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [shouldPoll, draftId, userId, leagueId, setDraftPicks])
}
